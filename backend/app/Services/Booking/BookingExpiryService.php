<?php

namespace App\Services\Booking;

use App\Enums\BookingStatus;
use App\Enums\ShowtimeStatus;
use App\Models\Booking;
use App\Models\Showtime;
use Illuminate\Support\Facades\DB;

/**
 * Time-driven clean-up. Every method re-reads current state under a lock and acts only if the condition
 * still holds, so running it twice, concurrently, or late is harmless.
 *
 * It only ever expires unpaid bookings (PENDING_PAYMENT whose hold lapsed, PAYMENT_REJECTED past the payment
 * deadline). Bookings in review, exception, confirmed or refund states are never touched here.
 */
class BookingExpiryService
{
    public function __construct(
        private readonly BookingStateMachine $machine,
        private readonly SeatInventoryService $inventory,
        private readonly PromoService $promos,
    ) {}

    /** @return int number of bookings expired */
    public function expireDue(): int
    {
        $expired = 0;
        $candidates = Booking::query()
            ->where(fn ($q) => $q
                ->where(fn ($w) => $w->where('status', BookingStatus::PENDING_PAYMENT->value)->where('hold_expires_at', '<=', now()))
                ->orWhere(fn ($w) => $w->where('status', BookingStatus::PAYMENT_REJECTED->value)->where('payment_deadline_at', '<=', now())))
            ->orderBy('id')->limit(500)->pluck('id');

        foreach ($candidates as $id) {
            $expired += $this->expireOne($id) ? 1 : 0;
        }

        return $expired;
    }

    public function expireOne(int $bookingId): bool
    {
        return DB::transaction(function () use ($bookingId) {
            $booking = Booking::whereKey($bookingId)->lockForUpdate()->first();
            if (! $booking) {
                return false;
            }

            $due = match ($booking->status) {
                BookingStatus::PENDING_PAYMENT => $booking->hold_expires_at->lte(now()),
                BookingStatus::PAYMENT_REJECTED => $booking->payment_deadline_at->lte(now()),
                default => false, // anything else (paid, in review, cancelled...) is not ours to release
            };
            if (! $due) {
                return false;
            }

            $this->machine->transition($booking, BookingStatus::EXPIRED, null, 'hold expired', function (Booking $b) {
                $this->inventory->releaseHolds($b);
                $this->promos->release($b);
            });

            return true;
        });
    }

    /** Showtimes whose film has finished are closed for good. */
    public function completeFinishedShowtimes(): int
    {
        return Showtime::where('status', ShowtimeStatus::OnSale->value)->where('ends_at', '<=', now())->update(['status' => ShowtimeStatus::Completed->value]);
    }

    public function pruneIdempotencyKeys(): int
    {
        return DB::table('idempotency_keys')->where('created_at', '<', now()->subDays(2))->delete();
    }
}
