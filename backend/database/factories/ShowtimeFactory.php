<?php

namespace Database\Factories;

use App\Models\Showtime;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Showtime> */
class ShowtimeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'movie_id' => \App\Models\Movie::factory(),
            'cinema_id' => fn () => \App\Models\Cinema::factory()->create()->id,
            'room_id' => fn (array $a) => \App\Models\ScreeningRoom::factory()->create(['cinema_id' => $a['cinema_id']])->id,
            'starts_at' => now()->addDays(2)->startOfHour(),
            'ends_at' => now()->addDays(2)->startOfHour()->addMinutes(140),
            'status' => 'on_sale',
        ];
    }
}
