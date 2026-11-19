<?php

namespace App\Services\Notification;

use App\Models\OutboxMessage;

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
    }
}
