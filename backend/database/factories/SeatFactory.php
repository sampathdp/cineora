<?php

namespace Database\Factories;

use App\Models\Seat;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Seat> */
class SeatFactory extends Factory
{
    public function definition(): array
    {
        return [
            'room_id' => \App\Models\ScreeningRoom::factory(),
            'row_label' => 'A',
            'number' => fake()->unique()->numberBetween(1, 60000),
            'seat_category_id' => \App\Models\SeatCategory::factory(),
            'is_active' => true,
        ];
    }
}
