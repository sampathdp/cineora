<?php

namespace App\Services\Showtime;

use App\Enums\ShowtimeSeatStatus;
use App\Models\Showtime;
use Illuminate\Support\Facades\DB;

/**
 * Read-only view of seat state for one showtime, always computed from the database.
 * It reports who-agnostic states only (available / held / sold / unavailable); it never caches and
 * never authorises a reservation: booking creation re-checks everything under row locks.
 */
class AvailabilityService
{
    /** @return list<array{key: string, row_label: string, number: int, category_key: string, category_name: string, price: int, status: string, x: int|null, y: int|null}> */
    public function seatMap(Showtime $showtime): array
    {
        $now = now();

        return DB::table('showtime_seats as ss')
            ->join('seats as s', 's.id', '=', 'ss.seat_id')
            ->join('seat_categories as c', 'c.id', '=', 's.seat_category_id')
            ->leftJoin('bookings as bk', 'bk.id', '=', 'ss.booking_id')
            ->where('ss.showtime_id', $showtime->id)
            ->orderBy('s.row_label')->orderBy('s.number')
            ->get(['s.row_label', 's.number', 's.x', 's.y', 's.is_active', 'c.key as category_key', 'c.name as category_name', 'ss.price', 'ss.status', 'ss.hold_expires_at', 'bk.status as booking_status'])
            ->map(fn ($r) => [
                'key' => $r->row_label.$r->number,
                'row_label' => $r->row_label,
                'number' => (int) $r->number,
                'category_key' => $r->category_key,
                'category_name' => $r->category_name,
                'price' => (int) $r->price,
                'status' => $this->state($r, $now),
                'x' => $r->x !== null ? (int) $r->x : null,
                'y' => $r->y !== null ? (int) $r->y : null,
            ])->all();
    }

    /** @return array{total: int, available: int, held: int, sold: int, unavailable: int} */
    public function counts(Showtime $showtime): array
    {
        $out = ['total' => 0, 'available' => 0, 'held' => 0, 'sold' => 0, 'unavailable' => 0];
        foreach ($this->seatMap($showtime) as $seat) {
            $out['total']++;
            $out[$seat['status']]++;
        }

        return $out;
    }

    private function state(object $row, $now): string
    {
        if (! $row->is_active) {
            return 'unavailable';
        }

        return match ($row->status) {
            ShowtimeSeatStatus::Sold->value => 'sold',
            ShowtimeSeatStatus::Blocked->value => 'unavailable',
            // A hold whose time has passed no longer protects the seat, even before the cleanup job runs.
            ShowtimeSeatStatus::Held->value => ($row->hold_expires_at !== null && $now->lt($row->hold_expires_at))
                // a clock that ran out does not free seats whose payment is under review or being sorted out
                || in_array($row->booking_status, ['PAYMENT_REVIEW', 'PAYMENT_EXCEPTION'], true) ? 'held' : 'available',
            default => 'available',
        };
    }
}
