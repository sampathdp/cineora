<?php

namespace App\Services\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Enums\TicketStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\RefundRequest;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Booking\BookingStateMachine;
use App\Services\Notification\Outbox;
use Illuminate\Support\Facades\DB;

/**
 * Refunds of money that was actually received. Customers can ask for confirmed bookings until shortly before the
 * show; staff with `refunds.decide` deny or pay. Tickets are voided as soon as a request is made so they cannot be
 * used while it is open, and restored if the request is denied. Whole-booking refunds only.
 */
class RefundService
{
    public function __construct(
        private readonly BookingStateMachine $machine,
        private readonly SeatProtection $protection,
        private readonly PaymentReviewService $reviews,
        private readonly AuditLogger $audit,
    ) {}

    public function request(Booking $booking, User $customer, string $reason): RefundRequest
    {
        return DB::transaction(function () use ($booking, $customer, $reason) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($locked->user_id !== $customer->id) {
                abort(404);
            }
            if ($locked->status !== BookingStatus::CONFIRMED) {
                throw new DomainConflictException('Only confirmed bookings can be refunded.', 'not_refundable');
            }
            if ($locked->showtime->starts_at->lte(now()->addHours((int) config('cineora.refund.cutoff_hours')))) {
                throw new DomainConflictException('Refunds can no longer be requested for this showtime.', 'refund_window_closed');
            }
            if (Ticket::where('booking_id', $locked->id)->where('status', TicketStatus::Used->value)->exists()) {
                throw new DomainConflictException('Some tickets were already used, so this booking cannot be refunded.', 'tickets_used');
            }

            $refund = new RefundRequest(['booking_id' => $locked->id, 'requested_by' => $customer->id, 'reason' => $reason, 'amount' => (int) $locked->total]);
            $refund->status = RefundStatus::Pending;
            $refund->save();

            $this->machine->transition($locked, BookingStatus::REFUND_PENDING, $customer, 'refund requested', function (Booking $b) {
                Ticket::where('booking_id', $b->id)->where('status', TicketStatus::Valid->value)->update(['status' => TicketStatus::Void->value]);
                Outbox::publish('refund.requested', ['booking_id' => $b->id]);
            });
            $this->audit->log('refund.requested', $customer, 'refund', $refund->public_id, ['booking' => $locked->public_id, 'amount' => (int) $refund->amount]);

            return $refund;
        });
    }

    public function deny(RefundRequest $refund, User $staff, string $reason): RefundRequest
    {
        return DB::transaction(function () use ($refund, $staff, $reason) {
            [$booking, $refund] = $this->lock($refund);
            if ($booking->status !== BookingStatus::REFUND_PENDING) {
                throw new DomainConflictException('This booking is not waiting for a refund decision.', 'invalid_state');
            }

            if (! Payment::where('booking_id', $booking->id)->where('status', PaymentStatus::VERIFIED->value)->exists()) {
                // e.g. a cancelled exception booking: the seats are gone, so the booking cannot be revived.
                throw new DomainConflictException('This refund cannot be denied because the booking was already cancelled. Record the payout instead.', 'cannot_deny');
            }

            $refund->forceFill(['status' => RefundStatus::Denied, 'decided_by' => $staff->id, 'decided_at' => now()])->save();
            $this->machine->transition($booking, BookingStatus::CONFIRMED, $staff, 'refund denied: '.mb_substr($reason, 0, 150), function (Booking $b) {
                Ticket::where('booking_id', $b->id)->where('status', TicketStatus::Void->value)->update(['status' => TicketStatus::Valid->value]);
            });
            Outbox::publish('refund.denied', ['booking_id' => $booking->id, 'reason' => mb_substr($reason, 0, 200)]);
            $this->audit->log('refund.denied', $staff, 'refund', $refund->public_id, ['booking' => $booking->public_id]);

            return $refund;
        });
    }

    /** Records that the money was sent back. Completes the booking as REFUNDED and returns the seats to sale. */
    public function markPaid(RefundRequest $refund, User $staff, string $reference): RefundRequest
    {
        return DB::transaction(function () use ($refund, $staff, $reference) {
            [$booking, $refund] = $this->lock($refund);
            if ($booking->status !== BookingStatus::REFUND_PENDING) {
                throw new DomainConflictException('This booking is not waiting for a refund.', 'invalid_state');
            }

            $refund->transactions()->create(['amount' => $refund->amount, 'reference' => $reference, 'paid_at' => now(), 'recorded_by' => $staff->id]);
            $refund->forceFill(['status' => RefundStatus::Paid, 'decided_by' => $staff->id, 'decided_at' => $refund->decided_at ?? now()])->save();

            $payment = Payment::where('booking_id', $booking->id)->whereIn('status', [PaymentStatus::VERIFIED->value, PaymentStatus::REFUND_PENDING->value])->lockForUpdate()->latest('id')->first();
            if ($payment) {
                if ($payment->status === PaymentStatus::VERIFIED) {
                    $this->reviews->setPaymentStatus($payment, PaymentStatus::REFUND_PENDING);
                }
                $this->reviews->setPaymentStatus($payment, PaymentStatus::REFUNDED);
            }

            $this->machine->transition($booking, BookingStatus::REFUNDED, $staff, 'refund paid', function (Booking $b) use ($reference) {
                Ticket::where('booking_id', $b->id)->whereIn('status', [TicketStatus::Valid->value, TicketStatus::Void->value])->update(['status' => TicketStatus::Refunded->value]);
                $this->protection->releaseAll($b);
                Outbox::publish('refund.completed', ['booking_id' => $b->id, 'reference' => mb_substr($reference, 0, 80)]);
            });
            $this->audit->log('refund.paid', $staff, 'refund', $refund->public_id, ['booking' => $booking->public_id, 'amount' => (int) $refund->amount]);

            return $refund;
        });
    }

    /** @return array{0: Booking, 1: RefundRequest} locked in booking-then-refund order */
    private function lock(RefundRequest $refund): array
    {
        $booking = Booking::whereKey($refund->booking_id)->lockForUpdate()->firstOrFail();
        $fresh = RefundRequest::whereKey($refund->id)->lockForUpdate()->firstOrFail();
        if ($fresh->status !== RefundStatus::Pending) {
            throw new DomainConflictException('This refund request has already been handled.', 'invalid_state');
        }

        return [$booking, $fresh];
    }
}
