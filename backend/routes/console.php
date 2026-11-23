<?php

use App\Jobs\RunBookingMaintenance;
use App\Mail\TemplateMail;
use App\Services\Booking\BookingExpiryService;
use App\Services\Notification\OutboxDispatcher;
use App\Services\Payment\PaymentExceptionService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
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

Artisan::command('mail:test {to}', function (string $to) {
    Mail::to($to)->send(new TemplateMail('Test email from '.config('app.name'), [
        'If you can read this, outgoing mail is working.',
        'Mailer: '.config('mail.default'),
    ]));
    $this->info("Sent a test email to {$to} via the '".config('mail.default')."' mailer.");
})->purpose('Send a test email to check the mail configuration');
