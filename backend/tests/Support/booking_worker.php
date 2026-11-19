<?php

/**
 * Child process used by the concurrency tests: boots the real application and attempts one booking at a
 * synchronised start time, then prints a JSON result. Invoked with:
 *   php booking_worker.php <userId> <showtimePublicId> <seatsCsv> <idempotencyKey> <startAtUnixFloat>
 */

use App\Models\User;
use App\Services\Booking\BookingService;
use App\Services\Booking\SeatsUnavailableException;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

[, $userId, $showtime, $seats, $key, $startAt] = $argv;

// Test aid: pause right after the availability read so concurrent workers overlap for certain.
// Production code is untouched; with correct locking the pause just makes the workers queue up.
if (($delay = (int) getenv('WORKER_QUERY_DELAY_MS')) > 0) {
    Illuminate\Support\Facades\DB::listen(function ($query) use ($delay) {
        if (str_starts_with(ltrim($query->sql), 'select') && str_contains($query->sql, 'from `showtime_seats`')) {
            usleep($delay * 1000);
        }
    });
}

while (microtime(true) < (float) $startAt) {
    usleep(200);
}

try {
    [$booking, $replayed] = app(BookingService::class)->create(User::findOrFail((int) $userId), ['showtime' => $showtime, 'seats' => explode(',', $seats)], $key);
    echo json_encode(['ok' => true, 'ref' => $booking->reference, 'id' => $booking->public_id, 'replayed' => $replayed]);
} catch (SeatsUnavailableException $e) {
    echo json_encode(['ok' => false, 'code' => 'seats_unavailable', 'seats' => $e->seats]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'code' => get_class($e), 'msg' => mb_substr($e->getMessage(), 0, 300)]);
}
