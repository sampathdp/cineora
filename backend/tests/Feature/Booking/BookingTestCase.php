<?php

namespace Tests\Feature\Booking;

use App\Enums\Role;
use App\Models\Showtime;
use App\Models\User;
use Tests\Feature\Showtime\ShowtimeTestCase;

abstract class BookingTestCase extends ShowtimeTestCase
{
    protected Showtime $showtime;

    protected function setUp(): void
    {
        parent::setUp();
        $this->showtime = $this->onSaleShowtime();
    }

    protected function onSaleShowtime(array $over = []): Showtime
    {
        $this->as($this->staff(Role::SuperAdmin));
        $id = $this->createShowtime($over);
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertOk();

        return Showtime::where('public_id', $id)->firstOrFail();
    }

    protected function book(User $user, array $seats, ?string $key = null, array $extra = [], ?Showtime $showtime = null)
    {
        return $this->as($user)->postJson('/api/v1/bookings', array_merge([
            'showtime' => ($showtime ?? $this->showtime)->public_id,
            'seats' => $seats,
        ], $extra), ['Idempotency-Key' => $key ?? 'key-'.bin2hex(random_bytes(6))]);
    }
}
