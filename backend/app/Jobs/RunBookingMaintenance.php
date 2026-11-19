<?php

namespace App\Jobs;

use App\Services\Booking\BookingExpiryService;
use App\Services\Content\ContentService;
use App\Services\Notification\OutboxDispatcher;
use App\Services\Payment\PaymentExceptionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * The once-a-minute housekeeping pass. Every step re-checks current state under locks, so running it twice,
 * concurrently or late is harmless:
 *  - expire unpaid bookings whose hold lapsed and release their seats;
 *  - move proofs that are still unreviewed at the payment deadline into the exception queue (seats stay protected);
 *  - close finished showtimes, prune old idempotency keys;
 *  - deliver pending notification emails from the outbox.
 */
class RunBookingMaintenance implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function handle(BookingExpiryService $expiry, ?PaymentExceptionService $exceptions = null, ?OutboxDispatcher $outbox = null): void
    {
        $exceptions ??= app(PaymentExceptionService::class);
        $outbox ??= app(OutboxDispatcher::class);

        $expired = $expiry->expireDue();
        $escalated = $exceptions->detectDue();
        $completed = $expiry->completeFinishedShowtimes();
        $pruned = $expiry->pruneIdempotencyKeys();
        $delivered = $outbox->dispatchDue();
        $published = app(ContentService::class)->publishDue(); // scheduled events and articles whose time has come

        if ($expired || $escalated || $completed || $pruned || $delivered || $published) {
            Log::info('Booking maintenance', compact('expired', 'escalated', 'completed', 'pruned', 'delivered', 'published'));
        }
    }
}
