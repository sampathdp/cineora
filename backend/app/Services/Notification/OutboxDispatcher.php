<?php

namespace App\Services\Notification;

use App\Enums\TicketStatus;
use App\Mail\TemplateMail;
use App\Mail\TicketsMail;
use App\Models\Booking;
use App\Models\NotificationAttempt;
use App\Models\OutboxMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/** Delivers outbox messages. Safe to run concurrently (rows are claimed with SKIP LOCKED) and to repeat. */
class OutboxDispatcher
{
    private const MAX_ATTEMPTS = 5;

    /** @return int number of messages delivered */
    public function dispatchDue(int $limit = 50): int
    {
        $claimed = DB::transaction(function () use ($limit) {
            $rows = OutboxMessage::query()
                ->where(fn ($q) => $q
                    ->where(fn ($w) => $w->where('status', 'pending')->where('available_at', '<=', now()))
                    // a worker that died mid-send leaves 'sending' behind; take those over after 10 minutes
                    ->orWhere(fn ($w) => $w->where('status', 'sending')->where('updated_at', '<', now()->subMinutes(10))))
                ->orderBy('id')->limit($limit)->lock('for update skip locked')->get();
            foreach ($rows as $row) {
                $row->forceFill(['status' => 'sending', 'attempts' => $row->attempts + 1])->save();
            }

            return $rows;
        });

        $sent = 0;
        foreach ($claimed as $message) {
            try {
                $this->deliver($message);
                $message->forceFill(['status' => 'sent', 'last_error' => null])->save();
                NotificationAttempt::create(['notification_ref' => "outbox:{$message->id}", 'channel' => 'mail', 'status' => 'sent']);
                $sent++;
            } catch (Throwable $e) {
                $final = $message->attempts >= self::MAX_ATTEMPTS;
                $message->forceFill([
                    'status' => $final ? 'failed' : 'pending',
                    'available_at' => now()->addMinutes(min(60, 2 ** $message->attempts)),
                    'last_error' => mb_substr(class_basename($e).': '.$e->getMessage(), 0, 250),
                ])->save();
                NotificationAttempt::create(['notification_ref' => "outbox:{$message->id}", 'channel' => 'mail', 'status' => 'failed', 'error_summary' => mb_substr(class_basename($e), 0, 250)]);
            }
        }

        return $sent;
    }

    private function deliver(OutboxMessage $message): void
    {
        $p = $message->payload;
        $booking = isset($p['booking_id']) ? Booking::with('user', 'showtime.movie')->find($p['booking_id']) : null;
        if (! $booking) {
            return; // the booking is gone: nothing to tell anyone
        }
        $site = rtrim((string) config('cineora.frontend_url'), '/');
        $title = $booking->showtime?->movie?->title ?? 'your booking';
        $link = ["{$site}/account/bookings/{$booking->public_id}", 'View booking'];

        if ($message->type === 'booking.confirmed') {
            if (! $booking->tickets()->where('status', TicketStatus::Valid)->exists()) {
                return; // cancelled or refunded before we got to it: no tickets to send
            }
            Mail::to($booking->user->email)->send(new TicketsMail($booking, $site.'/account/tickets'));

            return;
        }

        [$subject, $lines, $action] = match ($message->type) {
            'payment.proof_received' => ["We received your payment proof ({$booking->reference})", ["We received your bank transfer proof for {$title}.", 'A member of our team will verify it shortly. Your seats stay reserved while we check.'], $link],
            'payment.rejected' => ["Your payment could not be verified ({$booking->reference})", ["We could not verify the transfer for {$title}.", 'Reason: '.($p['reason'] ?? 'not specified'), 'If you still have time, you can upload a new proof from your booking page.'], $link],
            'payment.exception' => ["We need to check your booking ({$booking->reference})", ["Your payment for {$title} needs a manual check by our team.", 'Your seats are protected while we look into it. We will contact you if we need anything from you.'], $link],
            'booking.cancelled' => ["Your booking was cancelled ({$booking->reference})", ["Your booking for {$title} was cancelled."], $link],
            'refund.requested' => ["We received your refund request ({$booking->reference})", ["We received your refund request for {$title}.", 'We will review it and email you the outcome.'], $link],
            'refund.denied' => ["Your refund request was declined ({$booking->reference})", ["Your refund request for {$title} was declined.", 'Reason: '.($p['reason'] ?? 'not specified'), 'Your tickets remain valid.'], $link],
            'refund.completed' => ["Your refund was sent ({$booking->reference})", ["Your refund for {$title} has been paid out.", 'Reference: '.($p['reference'] ?? '—')], $link],
            default => throw new \RuntimeException("Unknown outbox message type {$message->type}"),
        };

        Mail::to($booking->user->email)->send(new TemplateMail($subject, $lines, $action[1], $action[0]));
    }
}
