<?php

namespace App\Services\Booking;

use App\Enums\BookingStatus;
use App\Enums\ShowtimeSeatStatus;
use App\Enums\ShowtimeStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\IdempotencyKey;
use App\Models\Seat;
use App\Models\SeatHold;
use App\Models\Showtime;
use App\Models\ShowtimeSeat;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Payment\SeatProtection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates and cancels bookings.
 *
 * Concurrency model (the point of this class):
 *  1. the whole operation is one transaction, retried on deadlock;
 *  2. the customer's user row is locked first, so one customer cannot run two bookings at once;
 *  3. the requested `showtime_seats` rows are locked `FOR UPDATE` in ascending id order (a fixed order means
 *     overlapping requests queue up instead of deadlocking);
 *  4. availability is evaluated on the locked rows, never before;
 *  5. prices come from those locked rows; nothing numeric from the client is used;
 *  6. the unique index on live `booking_seats` allocations is a final safeguard.
 */
class BookingService
{
    public function __construct(
        private readonly BookingStateMachine $machine,
        private readonly SeatInventoryService $inventory,
        private readonly PromoService $promos,
        private readonly SeatProtection $protection,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{showtime: string, seats: list<string>, promo_code?: string|null}  $data
     * @return array{0: Booking, 1: bool} the booking and whether this was an idempotent replay
     */
    public function create(User $user, array $data, string $idempotencyKey): array
    {
        $labels = array_values(array_unique(array_map(fn ($s) => strtoupper(trim($s)), $data['seats'])));
        sort($labels);
        $promoCode = isset($data['promo_code']) && trim($data['promo_code']) !== '' ? trim($data['promo_code']) : null;
        $hash = hash('sha256', json_encode(['showtime' => $data['showtime'], 'seats' => $labels, 'promo' => $promoCode ? mb_strtolower($promoCode) : null]));

        return DB::transaction(fn () => $this->createInTransaction($user, $data['showtime'], $labels, $promoCode, $idempotencyKey, $hash), 3);
    }

    private function createInTransaction(User $user, string $showtimePublicId, array $labels, ?string $promoCode, string $key, string $hash): array
    {
        // Serialise this customer's bookings, and claim the idempotency key.
        User::whereKey($user->id)->lockForUpdate()->firstOrFail();

        try {
            $idem = IdempotencyKey::create(['user_id' => $user->id, 'key' => $key, 'request_hash' => $hash, 'resource_type' => 'booking']);
        } catch (QueryException $e) {
            if (($e->errorInfo[1] ?? null) !== 1062) {
                throw $e;
            }
            $existing = IdempotencyKey::where('user_id', $user->id)->where('key', $key)->firstOrFail();
            if (! hash_equals($existing->request_hash, $hash)) {
                throw ValidationException::withMessages(['idempotency_key' => ['This Idempotency-Key was already used for a different request.']]);
            }
            if (! $existing->resource_id) {
                throw new DomainConflictException('This request is already being processed.', 'request_in_progress');
            }

            return [Booking::findOrFail($existing->resource_id), true];
        }

        $max = (int) config('cineora.booking.max_seats_per_booking');
        if (count($labels) < 1 || count($labels) > $max) {
            throw ValidationException::withMessages(['seats' => ["Choose between 1 and {$max} seats."]]);
        }
        $pending = Booking::where('user_id', $user->id)->where('status', BookingStatus::PENDING_PAYMENT->value)->where('hold_expires_at', '>', now())->count();
        if ($pending >= (int) config('cineora.booking.max_active_unpaid_bookings')) {
            throw new DomainConflictException('You have too many unpaid bookings. Pay for or cancel one first.', 'too_many_pending');
        }

        $showtime = Showtime::where('public_id', $showtimePublicId)->first();
        if (! $showtime || $showtime->status !== ShowtimeStatus::OnSale || ! $showtime->cinema()->where('is_active', true)->exists() || $showtime->starts_at->lte(now())) {
            abort(404);
        }
        if (! $showtime->isBookable()) {
            throw new DomainConflictException('Ticket sales for this showtime have closed.', 'sales_closed');
        }

        // Map labels (A1) to this room's seats. No locks needed: the room layout is not what we protect.
        $seatRows = $this->seatsByLabel($showtime, $labels);
        $unknown = array_values(array_diff($labels, array_keys($seatRows)));
        if ($unknown) {
            throw ValidationException::withMessages(['seats' => ['Unknown seat(s): '.implode(', ', $unknown).'.']]);
        }

        // Lock the inventory rows in a fixed order, then decide on what we just locked.
        $locked = ShowtimeSeat::query()
            ->where('showtime_id', $showtime->id)
            ->whereIn('seat_id', collect($seatRows)->pluck('id'))
            ->orderBy('id')->lockForUpdate()->get()->keyBy('seat_id');

        $now = now();
        // A lapsed hold is only free if its booking is genuinely unpaid. If the customer's proof is under review (or in
        // the exception queue) the seats stay protected even when the clock has run out: the money may already be paid.
        $protectedBookings = Booking::whereIn('id', $locked->pluck('booking_id')->filter()->unique())
            ->whereIn('status', [BookingStatus::PAYMENT_REVIEW->value, BookingStatus::PAYMENT_EXCEPTION->value, BookingStatus::CONFIRMED->value])
            ->pluck('id')->flip();
        $unavailable = [];
        $items = [];
        foreach ($seatRows as $label => $seat) {
            $row = $locked[$seat->id] ?? null;
            $free = $row && $seat->is_active && (
                $row->status === ShowtimeSeatStatus::Available
                || ($row->status === ShowtimeSeatStatus::Held && $row->hold_expires_at !== null && $row->hold_expires_at->lte($now) && ! $protectedBookings->has($row->booking_id))
            );
            if (! $free) {
                $unavailable[] = $label;

                continue;
            }
            $items[] = ['label' => $label, 'seat' => $seat, 'row' => $row];
        }
        if ($unavailable) {
            throw new SeatsUnavailableException($unavailable);
        }

        // Price from the locked rows only.
        $subtotal = (int) collect($items)->sum(fn ($i) => (int) $i['row']->price);
        $discount = 0;
        $promo = null;
        if ($promoCode) {
            [$promo, $discount] = $this->promos->evaluate($promoCode, $user, $showtime, $subtotal);
        }
        $fee = count($items) * (int) config('cineora.booking.service_fee_per_seat');
        $holdUntil = $now->copy()->addMinutes((int) config('cineora.booking.seat_hold_minutes'));
        $deadline = $now->copy()->addMinutes((int) config('cineora.booking.payment_deadline_minutes'));

        $booking = new Booking([
            'reference' => $this->newReference(), 'user_id' => $user->id, 'showtime_id' => $showtime->id,
            'cinema_id' => $showtime->cinema_id, 'movie_id' => $showtime->movie_id,
            'subtotal' => $subtotal, 'discount' => $discount, 'fee' => $fee, 'total' => $subtotal - $discount + $fee,
            'currency' => $showtime->cinema->currency, 'promo_code_id' => $promo?->id,
            'hold_expires_at' => $holdUntil, 'payment_deadline_at' => $deadline,
        ]);
        $booking->status = BookingStatus::PENDING_PAYMENT;
        $booking->save();

        try {
            foreach ($items as $i) {
                $row = $i['row'];
                // Only a seat whose hold has lapsed still carries live allocation rows from the previous booking;
                // retire those. For a free seat there must be none, so the unique index below can catch any bug.
                if ($row->status === ShowtimeSeatStatus::Held) {
                    BookingSeat::where('showtime_seat_id', $row->id)->whereNull('released_at')->update(['released_at' => $now]);
                    SeatHold::where('showtime_seat_id', $row->id)->whereNull('released_at')->update(['released_at' => $now]);
                }

                BookingSeat::create([
                    'booking_id' => $booking->id, 'showtime_id' => $showtime->id, 'showtime_seat_id' => $row->id, 'seat_id' => $i['seat']->id,
                    'seat_label' => $i['label'], 'category_name' => $i['seat']->category->name, 'unit_price' => (int) $row->price,
                ]);
                SeatHold::create(['booking_id' => $booking->id, 'showtime_seat_id' => $row->id, 'expires_at' => $holdUntil]);
                $row->forceFill(['status' => ShowtimeSeatStatus::Held, 'booking_id' => $booking->id, 'hold_expires_at' => $holdUntil])->save();
            }
        } catch (QueryException $e) {
            // Last line of defence: the database refused a second live allocation of a seat.
            if (($e->errorInfo[1] ?? null) === 1062) {
                throw new SeatsUnavailableException($labels);
            }
            throw $e;
        }

        if ($promo) {
            $this->promos->redeem($promo, $user, $booking, $discount);
        }
        $this->machine->recordCreated($booking, $user);
        $booking->events()->create(['type' => 'created', 'payload' => ['seats' => array_keys($seatRows)]]);

        $idem->forceFill(['resource_id' => $booking->id])->save();

        return [$booking->load(['seats', 'showtime.movie', 'showtime.cinema', 'showtime.room']), false];
    }

    /** Owner cancels a booking that has not been paid for. Confirmed bookings need the refund workflow. */
    public function cancelUnpaid(Booking $booking, User $actor, string $reason = 'cancelled by customer'): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $reason) {
            $fresh = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (! in_array($fresh->status, [BookingStatus::PENDING_PAYMENT, BookingStatus::PAYMENT_REJECTED], true)) {
                throw new DomainConflictException('This booking can no longer be cancelled here.', 'not_cancellable');
            }

            return $this->machine->transition($fresh, BookingStatus::CANCELLED, $actor, $reason, function (Booking $b) {
                $this->inventory->releaseHolds($b);
                $this->promos->release($b);
            });
        });
    }

    /**
     * Staff give an unpaid booking more time to pay: the payment deadline and the seat hold both move to `$until`.
     * Only possible while the booking still owns all its seats and before the show starts.
     */
    public function extendPaymentTime(Booking $booking, User $actor, Carbon $until): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $until) {
            $fresh = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (! in_array($fresh->status, [BookingStatus::PENDING_PAYMENT, BookingStatus::PAYMENT_REJECTED, BookingStatus::PAYMENT_REVIEW], true)) {
                throw new DomainConflictException('Only unpaid bookings can get more time to pay.', 'not_extendable');
            }
            $startsAt = Showtime::whereKey($fresh->showtime_id)->value('starts_at');
            if ($startsAt !== null && $until->gte(Carbon::parse($startsAt))) {
                throw new DomainConflictException('The new payment time must be before the show starts.', 'after_showtime');
            }
            if (! $this->protection->seatsIntact($fresh)) {
                throw new DomainConflictException('The seats of this booking were already released, so its time cannot be extended.', 'seats_released');
            }

            $previous = $fresh->payment_deadline_at;
            $this->protection->protectUntil($fresh, $until);
            $fresh->forceFill(['payment_deadline_at' => $until])->save();
            $this->audit->log('booking.payment_time_extended', $actor, 'booking', $fresh->public_id, [
                'from' => $previous?->copy()->utc()->toIso8601String(), 'to' => $until->copy()->utc()->toIso8601String(),
            ]);

            return $fresh;
        });
    }

    /** @return array<string, Seat> keyed by label such as "A1", with category loaded */
    private function seatsByLabel(Showtime $showtime, array $labels): array
    {
        $pairs = [];
        foreach ($labels as $label) {
            if (preg_match('/^([A-Z]{1,2})(\d{1,2})$/', $label, $m)) {
                $pairs[] = [$m[1], (int) $m[2]];
            }
        }
        if (! $pairs) {
            return [];
        }

        $seats = Seat::query()->with('category')->where('room_id', $showtime->room_id)
            ->where(function ($q) use ($pairs) {
                foreach ($pairs as [$row, $num]) {
                    $q->orWhere(fn ($w) => $w->where('row_label', $row)->where('number', $num));
                }
            })->get();

        return $seats->mapWithKeys(fn (Seat $s) => [$s->row_label.$s->number => $s])->all();
    }

    private function newReference(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
        do {
            $ref = 'CIN-';
            for ($i = 0; $i < 8; $i++) {
                $ref .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Booking::where('reference', $ref)->exists());

        return $ref;
    }
}
