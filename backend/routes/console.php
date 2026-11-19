<?php

use App\Jobs\RunBookingMaintenance;
use App\Services\Booking\BookingExpiryService;
use App\Services\Notification\OutboxDispatcher;
use App\Services\Payment\PaymentExceptionService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Runs inline (no queue worker needed) every minute; the work is idempotent and lock-protected.
Schedule::call(fn () => (new RunBookingMaintenance)->handle(app(BookingExpiryService::class)))
    ->name('booking-maintenance')->everyMinute()->withoutOverlapping(5)->onOneServer();

Artisan::command('bookings:maintain', function (BookingExpiryService $expiry, PaymentExceptionService $exceptions, OutboxDispatcher $outbox) {
    $this->info('Expired bookings: '.$expiry->expireDue());
    $this->info('Escalated to exceptions: '.$exceptions->detectDue());
    $this->info('Completed showtimes: '.$expiry->completeFinishedShowtimes());
    $this->info('Pruned idempotency keys: '.$expiry->pruneIdempotencyKeys());
    $this->info('Emails delivered: '.$outbox->dispatchDue());
})->purpose('Expire lapsed unpaid bookings, escalate stale reviews, close finished showtimes, deliver pending emails');
