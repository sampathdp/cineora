<?php

namespace Database\Factories;

use App\Models\ScreeningRoom;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ScreeningRoom> */
class ScreeningRoomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'cinema_id' => \App\Models\Cinema::factory(),
            'name' => 'Hall '.fake()->unique()->numberBetween(1, 99999),
            'screen_type' => 'Standard',
            'is_active' => true,
        ];
    }
}
