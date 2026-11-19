<?php

namespace Tests\Feature\Showtime;

use App\Models\Cinema;
use App\Models\Movie;
use App\Models\ScreeningRoom;
use App\Models\Seat;
use App\Models\SeatCategory;
use Illuminate\Support\Carbon;
use Tests\Feature\Catalog\CatalogTestCase;

abstract class ShowtimeTestCase extends CatalogTestCase
{
    protected Cinema $cinema;

    protected ScreeningRoom $room;

    protected Movie $movie;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cinema = Cinema::factory()->create(['timezone' => 'Asia/Seoul']);
        $this->room = $this->roomWithSeats($this->cinema);
        $this->movie = $this->movie(['duration_min' => 100]);
    }

    /** Row A: 4 standard seats, row B: 2 premium seats. */
    protected function roomWithSeats(Cinema $cinema, ?string $name = null): ScreeningRoom
    {
        $room = ScreeningRoom::factory()->create(['cinema_id' => $cinema->id] + ($name ? ['name' => $name] : []));
        $std = SeatCategory::whereNull('cinema_id')->where('key', 'standard')->value('id');
        $prem = SeatCategory::whereNull('cinema_id')->where('key', 'premium')->value('id');
        foreach (range(1, 4) as $n) {
            Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $std, 'row_label' => 'A', 'number' => $n]);
        }
        foreach (range(1, 2) as $n) {
            Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $prem, 'row_label' => 'B', 'number' => $n]);
        }

        return $room;
    }

    protected function prices(int|float|string $standard = 12000, int|float|string $premium = 16000): array
    {
        return [['category_key' => 'standard', 'price' => $standard], ['category_key' => 'premium', 'price' => $premium]];
    }

    /** Local Seoul time N days ahead at HH:MM, as an ISO string with offset. */
    protected function at(int $days, string $time = '19:00'): string
    {
        return Carbon::now('Asia/Seoul')->addDays($days)->setTimeFromTimeString($time)->toIso8601String();
    }

    protected function payload(array $over = []): array
    {
        return array_merge([
            'movie' => $this->movie->public_id,
            'room' => $this->room->public_id,
            'starts_at' => $this->at(3),
            'prices' => $this->prices(),
        ], $over);
    }

    protected function admin()
    {
        return $this->staff(\App\Enums\Role::SuperAdmin);
    }

    protected function createShowtime(array $over = []): string
    {
        return $this->postJson('/api/v1/admin/showtimes', $this->payload($over))->assertCreated()->json('data.id');
    }
}
