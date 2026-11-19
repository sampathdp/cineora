<?php

namespace App\Services\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\ReviewDecision;
use App\Enums\ShowtimeStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Booking\BookingStateMachine;
use App\Services\Notification\Outbox;
use App\Services\Ticket\TicketIssuanceService;
use Illuminate\Support\Facades\DB;

/**
 * Staff decisions on a submitted payment proof. Authorisation (who may decide, never the customer or the
 * person who submitted) is done by PaymentPolicy before these methods run; everything else is enforced here:
 * state preconditions under row locks, matching amounts, still-valid seat allocation, append-only review rows.
 */
class PaymentReviewService
{
    public function __construct(
        private readonly BookingStateMachine $machine,
        private readonly SeatProtection $protection,
        private readonly TicketIssuanceService $tickets,
        private readonly AuditLogger $audit,
    ) {}

    public function verify(Payment $payment, User $reviewer, ?string $notes = null): Payment
    {
        $lapsed = false;
        $result = DB::transaction(function () use ($payment, $reviewer, $notes, &$lapsed) {
            [$booking, $payment] = $this->lock($payment, [BookingStatus::PAYMENT_REVIEW], [PaymentStatus::PROOF_SUBMITTED, PaymentStatus::UNDER_REVIEW]);

            // The deadline passed before anyone decided: this is now an exception, never a quiet approval.
            if ($booking->payment_deadline_at->lte(now())) {
                $this->enterException($booking, $payment, null, 'payment deadline reached while the proof was awaiting review');
                $lapsed = true;

                return $payment->refresh();
            }
            $this->assertAmountMatches($payment);
            $this->confirm($booking, $payment, $reviewer, $notes, 'payment verified');

            return $payment->refresh()->load(['reviews', 'proofs']);
        });

        if ($lapsed) {
            throw new DomainConflictException('The payment deadline passed before this proof was reviewed. It has been moved to the exception queue for an administrator.', 'deadline_passed');
        }

        return $result;
    }

    public function reject(Payment $payment, User $reviewer, string $reason, ?string $notes = null): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $reason, $notes) {
            [$booking, $payment] = $this->lock($payment, [BookingStatus::PAYMENT_REVIEW], [PaymentStatus::PROOF_SUBMITTED, PaymentStatus::UNDER_REVIEW]);

            $this->setPaymentStatus($payment, PaymentStatus::REJECTED);
            $payment->reviews()->create(['reviewer_id' => $reviewer->id, 'decision' => ReviewDecision::Rejected, 'reason' => $reason, 'internal_notes' => $notes]);
            // Seats stay protected until the original payment deadline, so the customer can resubmit.
            $this->machine->transition($booking, BookingStatus::PAYMENT_REJECTED, $reviewer, 'payment rejected: '.mb_substr($reason, 0, 150));
            Outbox::publish('payment.rejected', ['booking_id' => $booking->id, 'reason' => mb_substr($reason, 0, 200)]);
            $this->audit->log('payment.rejected', $reviewer, 'payment', $payment->public_id, ['booking' => $booking->public_id]);

            return $payment->refresh()->load(['reviews', 'proofs']);
        });
    }

    /** Hands a proof the verifier cannot settle (wrong amount, unclear) to the exception workflow. */
    public function markException(Payment $payment, User $reviewer, string $reason): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $reason) {
            [$booking, $payment] = $this->lock($payment, [BookingStatus::PAYMENT_REVIEW], [PaymentStatus::PROOF_SUBMITTED, PaymentStatus::UNDER_REVIEW]);

            $this->enterException($booking, $payment, $reviewer, $reason);
            $payment->reviews()->create(['reviewer_id' => $reviewer->id, 'decision' => ReviewDecision::Exception, 'reason' => $reason]);

            return $payment->refresh()->load(['reviews', 'proofs']);
        });
    }

    /** Shared by the verifier's decision and by an administrator resolving an exception. Runs inside a transaction. */
    public function confirm(Booking $booking, Payment $payment, User $reviewer, ?string $notes, string $reason): void
    {
        $showtime = $booking->showtime;
        if ($showtime->status !== ShowtimeStatus::OnSale || $showtime->starts_at->lte(now())) {
            throw new DomainConflictException('This showtime is no longer on sale, so tickets cannot be issued. Resolve it as an exception.', 'showtime_closed');
        }
        if (! $this->protection->seatsIntact($booking)) {
            throw new DomainConflictException('The seats of this booking are no longer reserved for it. Tickets cannot be issued automatically: resolve it as an exception.', 'seats_lost');
        }

        $this->setPaymentStatus($payment, PaymentStatus::VERIFIED);
        $payment->forceFill(['verified_at' => now()])->save();
        $payment->reviews()->create(['reviewer_id' => $reviewer->id, 'decision' => ReviewDecision::Verified, 'internal_notes' => $notes]);

        $this->machine->transition($booking, BookingStatus::CONFIRMED, $reviewer, $reason, function (Booking $b) {
            $this->protection->markSold($b);
            $this->tickets->issue($b);
            Outbox::publish('booking.confirmed', ['booking_id' => $b->id]);
        });
        $this->audit->log('payment.verified', $reviewer, 'payment', $payment->public_id, ['booking' => $booking->public_id, 'amount' => (int) $payment->expected_amount]);
    }

    /** Moves a booking and its payment into the exception queue and keeps the seats protected until the show. */
    public function enterException(Booking $booking, Payment $payment, ?User $actor, string $reason): void
    {
        $this->setPaymentStatus($payment, PaymentStatus::EXCEPTION);
        $payment->forceFill(['exception_at' => now()])->save();

        $this->machine->transition($booking, BookingStatus::PAYMENT_EXCEPTION, $actor, $reason, function (Booking $b) {
            // Never release or re-sell seats whose money is unresolved: protect them until the show starts.
            $this->protection->protectUntil($b, $b->showtime->starts_at);
            Outbox::publish('payment.exception', ['booking_id' => $b->id]);
        });
        $this->audit->log('payment.exception', $actor, 'payment', $payment->public_id, ['booking' => $booking->public_id, 'reason' => mb_substr($reason, 0, 150)]);
    }

    public function assertAmountMatches(Payment $payment): void
    {
        if ((int) $payment->submitted_amount !== (int) $payment->expected_amount) {
            throw new DomainConflictException(
                'The transferred amount ('.number_format((int) $payment->submitted_amount).') differs from the amount due ('.number_format((int) $payment->expected_amount).'). Reject the proof or send it to the exception queue.',
                'amount_mismatch',
            );
        }
    }

    public function setPaymentStatus(Payment $payment, PaymentStatus $to): void
    {
        if (! $payment->status->canTransitionTo($to)) {
            throw new DomainConflictException("A payment that is {$payment->status->value} cannot become {$to->value}.", 'invalid_state');
        }
        $payment->status = $to;
        $payment->save();
    }

    /**
     * Locks booking then payment (always in this order) and checks both are in an acceptable state.
     * A second reviewer arriving after the first finds a changed state here and gets a 409.
     *
     * @param  list<BookingStatus>  $bookingStates
     * @param  list<PaymentStatus>  $paymentStates
     * @return array{0: Booking, 1: Payment}
     */
    public function lock(Payment $payment, array $bookingStates, array $paymentStates): array
    {
        $booking = Booking::whereKey($payment->booking_id)->lockForUpdate()->firstOrFail();
        $fresh = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

        if (! in_array($fresh->status, $paymentStates, true) || ! in_array($booking->status, $bookingStates, true)) {
            throw new DomainConflictException('This payment has already been handled or is not awaiting review.', 'invalid_state');
        }

        return [$booking, $fresh];
    }
}
