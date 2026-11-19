<?php

/**
 * Child process for the door-scan concurrency test: boots the real application, waits for a shared start time and
 * validates one QR code as the given checker. Prints a JSON result.
 *   php ticket_worker.php <checkerUserId> <qrPayload> <startAtUnixFloat>
 */

use App\Models\User;
use App\Services\Ticket\TicketValidationService;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

[, $checkerId, $code, $startAt] = $argv;

// Test aid (production code untouched): pause right after the ticket is read so scanners overlap for certain.
if (($delay = (int) getenv('WORKER_QUERY_DELAY_MS')) > 0) {
    Illuminate\Support\Facades\DB::listen(function ($query) use ($delay) {
        if (str_starts_with(ltrim($query->sql), 'select') && str_contains($query->sql, 'from `tickets`')) {
            usleep($delay * 1000);
        }
    });
}

while (microtime(true) < (float) $startAt) {
    usleep(200);
}

try {
    $result = app(TicketValidationService::class)->validate(User::findOrFail((int) $checkerId), $code, null, null);
    echo json_encode(['ok' => true, 'result' => $result['result']]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => get_class($e), 'msg' => mb_substr($e->getMessage(), 0, 300)]);
}
