<?php

namespace Database\Factories;

use App\Models\BookingSeat;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BookingSeat> */
class BookingSeatFactory extends Factory
{
    public function definition(): array
    {
        return [
            'booking_id' => \App\Models\Booking::factory(),
            'showtime_id' => fn (array $a) => \App\Models\Booking::find($a['booking_id'])->showtime_id,
            'showtime_seat_id' => fn (array $a) => \App\Models\ShowtimeSeat::factory()->create(['showtime_id' => $a['showtime_id']])->id,
            'seat_id' => fn (array $a) => \App\Models\ShowtimeSeat::find($a['showtime_seat_id'])->seat_id,
            'seat_label' => 'A1',
            'category_name' => 'Standard',
            'unit_price' => 12000,
        ];
    }
}
