<?php

namespace App\Services\Notification;

use App\Models\OutboxMessage;
use Illuminate\Support\Facades\DB;

/**
 * Transactional outbox: business code records "this must be sent" in the SAME transaction as the state change,
 * and a worker delivers it afterwards. A mail outage can therefore never roll back (or silently lose) a payment
 * decision, and a rolled-back transaction never sends mail about something that did not happen.
 */
class Outbox
{
    /** @param  array<string, scalar|null>  $payload  ids and short text only; never secrets */
    public static function publish(string $type, array $payload): void
    {
        OutboxMessage::create(['type' => $type, 'payload' => $payload, 'available_at' => now()]);

        // Deliver straight away once the transaction has committed and the response has gone out, so customers
        // are not waiting on the next scheduler tick. Failures stay pending and the scheduler retries them.
        if (config('cineora.mail.send_immediately') && ! self::$flushQueued) {
            self::$flushQueued = true;
            DB::afterCommit(fn () => app()->terminating(function () {
                self::$flushQueued = false;
                app(OutboxDispatcher::class)->dispatchDue();
            }));
        }
    }

    private static bool $flushQueued = false;
}
