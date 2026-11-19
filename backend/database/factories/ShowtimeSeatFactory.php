<?php

namespace Database\Factories;

use App\Models\ShowtimeSeat;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ShowtimeSeat> */
class ShowtimeSeatFactory extends Factory
{
    public function definition(): array
    {
        return [
            'showtime_id' => \App\Models\Showtime::factory(),
            'seat_id' => \App\Models\Seat::factory(),
            'price' => 12000,
            'status' => 'available',
        ];
    }
}
