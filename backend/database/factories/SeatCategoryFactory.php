<?php

namespace Database\Factories;

use App\Models\SeatCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SeatCategory> */
class SeatCategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'cinema_id' => null,
            'key' => fake()->unique()->lexify('cat-??????'),
            'name' => fake()->word(),
            'default_price' => 12000,
        ];
    }
}
