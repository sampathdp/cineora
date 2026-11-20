<?php

namespace Tests\Feature\Ticket;

use App\Enums\Role;
use App\Enums\TicketStatus;
use App\Models\Ticket;
use Illuminate\Support\Carbon;

class ScannerPairTest extends TicketTestCase
{
    public function test_paired_phone_scans_as_the_checker_and_desktop_receives_results(): void
    {
        $booking = $this->confirmed();
        $ticket = Ticket::where('booking_id', $booking->id)->first();
        $this->travelToDoors();

        $token = $this->as($this->checker)->postJson('/api/v1/admin/scanner/pairs')->assertOk()->json('data.token');
        $this->assertSame(48, strlen($token));

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/scanner/remote/{$token}")->assertOk();
        $this->postJson("/api/v1/scanner/remote/{$token}/scan", ['code' => $this->qr($ticket)])->assertJsonPath('data.result', 'valid');
        $this->postJson("/api/v1/scanner/remote/{$token}/scan", ['code' => $this->qr($ticket)])->assertJsonPath('data.result', 'already_used');
        $this->assertSame(TicketStatus::Used, $ticket->fresh()->status);

        $events = $this->as($this->checker)->getJson("/api/v1/admin/scanner/pairs/{$token}/events")->assertOk();
        $events->assertJsonPath('data.connected', true)->assertJsonCount(2, 'data.events');
        $this->getJson("/api/v1/admin/scanner/pairs/{$token}/events?after=1")->assertJsonCount(1, 'data.events')
            ->assertJsonPath('data.events.0.result.result', 'already_used');
        Carbon::setTestNow();
    }

    public function test_pairing_is_private_and_revocable(): void
    {
        $token = $this->as($this->checker)->postJson('/api/v1/admin/scanner/pairs')->assertOk()->json('data.token');

        $other = $this->staff(Role::TicketChecker);
        $this->as($other)->getJson("/api/v1/admin/scanner/pairs/{$token}/events")->assertNotFound();
        $this->as($this->customer)->postJson('/api/v1/admin/scanner/pairs')->assertForbidden();

        $this->as($this->checker)->deleteJson("/api/v1/admin/scanner/pairs/{$token}")->assertOk();
        $this->getJson("/api/v1/scanner/remote/{$token}")->assertNotFound();
        $this->postJson("/api/v1/scanner/remote/{$token}/scan", ['code' => 'x'])->assertNotFound();
        $this->getJson('/api/v1/scanner/remote/'.str_repeat('a', 48))->assertNotFound();
    }
}
