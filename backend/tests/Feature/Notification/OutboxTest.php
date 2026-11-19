<?php

namespace Tests\Feature\Notification;

use App\Enums\BookingStatus;
use App\Mail\TemplateMail;
use App\Models\OutboxMessage;
use App\Services\Notification\Outbox;
use App\Services\Notification\OutboxDispatcher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Ticket\TicketTestCase;

class OutboxTest extends TicketTestCase
{
    public function test_the_whole_customer_journey_produces_the_expected_emails_exactly_once(): void
    {
        Mail::fake();
        $booking = $this->reserve();
        $this->submit($booking)->assertCreated();
        $payment = $booking->payments()->first();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/verify")->assertOk();

        $this->assertSame(2, OutboxMessage::where('status', 'pending')->count());
        $this->assertSame(2, app(OutboxDispatcher::class)->dispatchDue());
        $this->assertSame(0, app(OutboxDispatcher::class)->dispatchDue(), 'nothing is sent twice');

        Mail::assertSent(TemplateMail::class, 2);
        Mail::assertSent(TemplateMail::class, fn ($m) => $m->hasTo($this->customer->email));
        $this->assertSame(2, OutboxMessage::where('status', 'sent')->count());
        $this->assertSame(2, \DB::table('notification_attempts')->where('status', 'sent')->count());
    }

    public function test_a_mail_outage_never_rolls_back_the_decision_and_is_retried_with_backoff(): void
    {
        [$booking, $payment] = $this->inReview();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/verify")->assertOk();
        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);

        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP is down'));
        $this->assertSame(0, app(OutboxDispatcher::class)->dispatchDue());

        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status, 'the booking stays confirmed');
        $failed = OutboxMessage::where('attempts', 1)->get();
        $this->assertCount(2, $failed);
        $this->assertSame('pending', $failed[0]->status);
        $this->assertTrue($failed[0]->available_at->gt(now()));
        $this->assertStringContainsString('SMTP is down', $failed[0]->last_error);

        // Not due yet: untouched. Once due, it is retried and, with mail back, delivered.
        $this->assertSame(0, app(OutboxDispatcher::class)->dispatchDue());
        Carbon::setTestNow(now()->addHour());
        \Mockery::close();
    }

    public function test_after_repeated_failures_a_message_is_marked_failed_not_retried_forever(): void
    {
        Outbox::publish('booking.confirmed', ['booking_id' => $this->reserve()->id]);
        $msg = OutboxMessage::firstOrFail();
        $msg->forceFill(['attempts' => 4])->save();

        Mail::shouldReceive('to')->andThrow(new \RuntimeException('still down'));
        app(OutboxDispatcher::class)->dispatchDue();

        $this->assertSame('failed', $msg->fresh()->status);
        $this->assertSame(0, app(OutboxDispatcher::class)->dispatchDue());
    }

    public function test_unknown_types_and_missing_bookings_do_not_block_the_queue(): void
    {
        Mail::fake();
        Outbox::publish('something.unknown', ['booking_id' => $this->reserve()->id]);
        Outbox::publish('booking.confirmed', ['booking_id' => 999999]);

        app(OutboxDispatcher::class)->dispatchDue();

        $this->assertSame('pending', OutboxMessage::where('type', 'something.unknown')->value('status')); // retried later, flagged by last_error
        $this->assertNotNull(OutboxMessage::where('type', 'something.unknown')->value('last_error'));
        $this->assertSame('sent', OutboxMessage::where('type', 'booking.confirmed')->value('status'));
        Mail::assertNothingSent();
    }

    public function test_emails_never_contain_proof_files_account_numbers_or_qr_tokens(): void
    {
        Mail::fake();
        $booking = $this->confirmed();
        app(OutboxDispatcher::class)->dispatchDue();

        Mail::assertSent(TemplateMail::class, function (TemplateMail $mail) use ($booking) {
            $html = $mail->render();
            $ticket = \App\Models\Ticket::where('booking_id', $booking->id)->first();
            foreach (['110-123-456789', $ticket->qr_token_encrypted, 'CINEORA1:', 'payment-proofs'] as $secret) {
                $this->assertStringNotContainsString($secret, $html);
            }

            return true;
        });
    }
}
