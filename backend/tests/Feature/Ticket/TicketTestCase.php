<?php

namespace Tests\Feature\Ticket;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Ticket\TicketIssuanceService;
use Illuminate\Support\Carbon;
use Tests\Feature\Payment\PaymentTestCase;

abstract class TicketTestCase extends PaymentTestCase
{
    protected User $checker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->checker = $this->staff(Role::TicketChecker);
        $this->checker->cinemas()->attach($this->cinema);
        $this->checker->flushAccessCache();
    }

    /** A confirmed booking with issued tickets, reached through the real review path. */
    protected function confirmed(?User $user = null, array $seats = ['A1', 'A2'], int $seed = 1): Booking
    {
        [$booking, $payment] = $this->inReview($user, $seats, $seed);
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/verify")->assertOk();

        return $booking->refresh();
    }

    /** Raw QR payload of a ticket, the way the owner's page would receive it. */
    protected function qr(Ticket $ticket): string
    {
        return TicketIssuanceService::qrPayload($ticket->qr_token_encrypted);
    }

    /** Moves "now" into the check-in window for the test showtime. */
    protected function travelToDoors(): void
    {
        Carbon::setTestNow($this->showtime->fresh()->starts_at->copy()->subMinutes(30));
    }

    protected function scan(string $code, ?User $as = null, array $extra = [])
    {
        return $this->as($as ?? $this->checker)->postJson('/api/v1/admin/tickets/validate', array_merge(['code' => $code], $extra));
    }
}
