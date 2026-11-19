<?php

namespace App\Services\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\RefundRequest;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Booking\BookingStateMachine;
use Illuminate\Support\Facades\DB;

/**
 * The exception queue: late proofs, mismatched amounts, seats that were lost. Nothing here is automatic except
 * detection; a human with `bookings.resolve_exceptions` decides, and the outcome is either a confirmation
 * (only when the seats are still validly allocated) or a cancellation with a refund request.
 */
class PaymentExceptionService
{
    public function __construct(
        private readonly PaymentReviewService $reviews,
        private readonly BookingStateMachine $machine,
        private readonly SeatProtection $protection,
        private readonly AuditLogger $audit,
    ) {}

    /** Scheduler entry point: bookings still waiting for review when their payment deadline arrives. */
    public function detectDue(): int
    {
        $count = 0;
        $ids = Booking::where('status', BookingStatus::PAYMENT_REVIEW->value)->where('payment_deadline_at', '<=', now())->orderBy('id')->limit(200)->pluck('id');
        foreach ($ids as $id) {
            $count += DB::transaction(function () use ($id) {
                $booking = Booking::whereKey($id)->lockForUpdate()->first();
                // Re-check under the lock: a verifier may have just decided.
                if (! $booking || $booking->status !== BookingStatus::PAYMENT_REVIEW || $booking->payment_deadline_at->gt(now())) {
                    return 0;
                }
                $payment = Payment::where('booking_id', $booking->id)->whereIn('status', [PaymentStatus::PROOF_SUBMITTED->value, PaymentStatus::UNDER_REVIEW->value])->lockForUpdate()->latest('id')->first();
                if (! $payment) {
                    return 0;
                }
                $this->reviews->enterException($booking, $payment, null, 'payment deadline reached while the proof was awaiting review');

                return 1;
            });
        }

        return $count;
    }

    /**
     * Administrator confirms an exception booking after checking the money arrived.
     * Refused if the seats are no longer allocated to the booking; a different amount needs explicit acknowledgement.
     */
    public function confirm(Payment $payment, User $admin, string $note, bool $acknowledgeAmountDifference = false): Payment
    {
        return DB::transaction(function () use ($payment, $admin, $note, $acknowledgeAmountDifference) {
            [$booking, $payment] = $this->reviews->lock($payment, [BookingStatus::PAYMENT_EXCEPTION], [PaymentStatus::EXCEPTION]);
            if (! $acknowledgeAmountDifference) {
                $this->reviews->assertAmountMatches($payment);
            }
            $this->reviews->confirm($booking, $payment, $admin, $note, 'exception resolved: payment accepted');

            return $payment->refresh()->load(['reviews', 'proofs']);
        });
    }

    /** Administrator cancels an exception booking. Money that arrived is queued for refund; seats go back on sale. */
    public function cancel(Payment $payment, User $admin, string $note): Payment
    {
        return DB::transaction(function () use ($payment, $admin, $note) {
            [$booking, $payment] = $this->reviews->lock($payment, [BookingStatus::PAYMENT_EXCEPTION], [PaymentStatus::EXCEPTION]);
            $received = (int) $payment->submitted_amount;

            if ($received > 0) {
                $this->reviews->setPaymentStatus($payment, PaymentStatus::REFUND_PENDING);
                $refund = new RefundRequest(['booking_id' => $booking->id, 'requested_by' => $admin->id, 'reason' => mb_substr('Exception cancelled: '.$note, 0, 1000), 'amount' => $received]);
                $refund->status = RefundStatus::Pending;
                $refund->save();
                $this->machine->transition($booking, BookingStatus::REFUND_PENDING, $admin, 'exception cancelled; refund due', fn (Booking $b) => $this->protection->releaseAll($b));
            } else {
                $this->machine->transition($booking, BookingStatus::CANCELLED, $admin, 'exception cancelled', fn (Booking $b) => $this->protection->releaseAll($b));
            }
            $this->audit->log('payment.exception_cancelled', $admin, 'payment', $payment->public_id, ['booking' => $booking->public_id, 'refund_due' => $received]);

            return $payment->refresh()->load(['reviews', 'proofs']);
        });
    }

    public function assertResolvable(Booking $booking): void
    {
        if ($booking->status !== BookingStatus::PAYMENT_EXCEPTION) {
            throw new DomainConflictException('This booking is not in the exception queue.', 'invalid_state');
        }
    }
}
