<?php

namespace Database\Factories;

use App\Models\Cinema;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Cinema> */
class CinemaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(2),
            'name' => fake()->company().' Cinema',
            'address' => fake()->streetAddress(),
            'timezone' => 'Asia/Seoul',
            'currency' => 'KRW',
            'is_active' => true,
        ];
    }
}
