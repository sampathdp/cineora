<?php

namespace Database\Factories;

use App\Models\Movie;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Movie> */
class MovieFactory extends Factory
{
    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(3),
            'title' => fake()->sentence(3),
            'duration_min' => 110,
            'status' => 'published',
            'screening_status' => 'now_playing',
        ];
    }
}
