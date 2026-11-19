<?php

namespace Database\Factories;

use App\Models\Booking;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Booking> */
class BookingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reference' => strtoupper(fake()->unique()->bothify('CIN-######')),
            'user_id' => \App\Models\User::factory(),
            'showtime_id' => fn () => \App\Models\Showtime::factory()->create()->id,
            'cinema_id' => fn (array $a) => \App\Models\Showtime::find($a['showtime_id'])->cinema_id,
            'movie_id' => fn (array $a) => \App\Models\Showtime::find($a['showtime_id'])->movie_id,
            'status' => 'PENDING_PAYMENT',
            'subtotal' => 24000,
            'discount' => 0,
            'fee' => 0,
            'total' => 24000,
            'currency' => 'KRW',
            'hold_expires_at' => now()->addMinutes(15),
            'payment_deadline_at' => now()->addMinutes(30),
        ];
    }
}
