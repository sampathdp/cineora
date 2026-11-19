<?php

namespace App\Services\Booking;

use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\SeatHold;
use Illuminate\Support\Facades\DB;

/** Moves seat inventory between held / available for a booking. Always called inside a transaction. */
class SeatInventoryService
{
    /**
     * Gives back the seats of a booking that never reached a sale. Only rows still marked `held` for this
     * exact booking are touched, so seats that were already re-allocated to someone else are left alone.
     */
    public function releaseHolds(Booking $booking): void
    {
        $now = now();

        DB::table('showtime_seats')
            ->where('booking_id', $booking->id)->where('status', 'held')
            ->update(['status' => 'available', 'booking_id' => null, 'hold_expires_at' => null, 'updated_at' => $now]);

        BookingSeat::where('booking_id', $booking->id)->whereNull('released_at')->update(['released_at' => $now]);
        SeatHold::where('booking_id', $booking->id)->whereNull('released_at')->update(['released_at' => $now]);
    }
}
