<?php

namespace App\Services\Payment;

use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\SeatHold;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Keeps a booking's seats allocated to it (or checks that they still are). Runs inside the caller's transaction. */
class SeatProtection
{
    /**
     * True only if every seat of the booking is still allocated to exactly this booking: nothing released,
     * nothing re-assigned, nothing sold. Anything else means "do not issue tickets automatically".
     */
    public function seatsIntact(Booking $booking): bool
    {
        $allocations = BookingSeat::where('booking_id', $booking->id)->get(['id', 'showtime_seat_id', 'released_at']);
        if ($allocations->isEmpty() || $allocations->contains(fn ($a) => $a->released_at !== null)) {
            return false;
        }

        $held = DB::table('showtime_seats')->where('booking_id', $booking->id)->whereIn('id', $allocations->pluck('showtime_seat_id'))
            ->where('status', 'held')->lockForUpdate()->count();

        return $held === $allocations->count();
    }

    /** Extends how long the seats stay protected (hold rows, inventory rows and the booking's own hold time). */
    public function protectUntil(Booking $booking, Carbon $until): void
    {
        DB::table('showtime_seats')->where('booking_id', $booking->id)->where('status', 'held')->update(['hold_expires_at' => $until, 'updated_at' => now()]);
        SeatHold::where('booking_id', $booking->id)->whereNull('released_at')->update(['expires_at' => $until]);
        $booking->forceFill(['hold_expires_at' => $until])->save();
    }

    /** Seats become permanently sold to this booking (payment verified). */
    public function markSold(Booking $booking): void
    {
        DB::table('showtime_seats')->where('booking_id', $booking->id)->where('status', 'held')->update(['status' => 'sold', 'hold_expires_at' => null, 'updated_at' => now()]);
        SeatHold::where('booking_id', $booking->id)->whereNull('released_at')->update(['released_at' => now()]);
    }

    /** Gives all seats of a booking back to sale (sold or held), retiring its allocations. */
    public function releaseAll(Booking $booking): void
    {
        DB::table('showtime_seats')->where('booking_id', $booking->id)->whereIn('status', ['held', 'sold'])
            ->update(['status' => 'available', 'booking_id' => null, 'hold_expires_at' => null, 'updated_at' => now()]);
        BookingSeat::where('booking_id', $booking->id)->whereNull('released_at')->update(['released_at' => now()]);
        SeatHold::where('booking_id', $booking->id)->whereNull('released_at')->update(['released_at' => now()]);
    }
}
