<?php

namespace App\Services\Booking;

use App\Enums\BookingStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * The only place a booking's status changes.
 *
 * Every transition re-reads the booking under a row lock (so a stale in-memory copy can never be acted on),
 * checks the allowed-transition map, writes an append-only history row and an audit entry, and sets the
 * matching timestamps. Callers do the surrounding side effects (seat release, tickets...) inside the same
 * transaction by passing a closure.
 */
class BookingStateMachine
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  null|callable(Booking): void  $sideEffects  runs inside the transaction after the status is validated
     */
    public function transition(Booking $booking, BookingStatus $to, ?User $actor, ?string $reason = null, ?callable $sideEffects = null): Booking
    {
        return DB::transaction(function () use ($booking, $to, $actor, $reason, $sideEffects) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if (! $from->canTransitionTo($to)) {
                throw new DomainConflictException("A booking that is {$from->value} cannot become {$to->value}.", 'invalid_transition');
            }

            $locked->status = $to;
            if ($to === BookingStatus::CONFIRMED) {
                $locked->confirmed_at = now();
            }
            if ($to === BookingStatus::CANCELLED) {
                $locked->cancelled_at = now();
            }
            $locked->save();

            $locked->histories()->create(['from_status' => $from->value, 'to_status' => $to->value, 'actor_user_id' => $actor?->id, 'reason' => $reason]);
            $this->audit->log('booking.status_changed', $actor, 'booking', $locked->public_id, ['from' => $from->value, 'to' => $to->value, 'reason' => $reason]);

            if ($sideEffects) {
                $sideEffects($locked);
            }

            return $locked;
        });
    }

    /** First history row for a new booking (no previous status). */
    public function recordCreated(Booking $booking, User $actor): void
    {
        $booking->histories()->create(['from_status' => null, 'to_status' => $booking->status->value, 'actor_user_id' => $actor->id, 'reason' => 'created']);
        $this->audit->log('booking.created', $actor, 'booking', $booking->public_id, ['seats' => $booking->seats()->count(), 'total' => (int) $booking->total]);
    }
}
