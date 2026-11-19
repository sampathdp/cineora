<?php

namespace Tests\Feature\Ticket;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Enums\TicketStatus;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\Cinema;
use App\Models\Ticket;
use App\Models\TicketCheckin;
use App\Models\TicketValidationEvent;
use App\Services\Ticket\TicketIssuanceService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TicketTest extends TicketTestCase
{
    // --- Issuance ------------------------------------------------------------------------

    public function test_tickets_exist_only_after_server_side_verification(): void
    {
        $booking = $this->reserve();
        $this->assertSame(0, Ticket::count());
        $this->as($this->customer)->getJson("/api/v1/bookings/{$booking->public_id}/tickets")->assertOk()->assertJsonCount(0, 'data');

        // The only way in is the review service; the model/service refuses unconfirmed bookings outright.
        $this->expectException(\App\Exceptions\DomainConflictException::class);
        app(TicketIssuanceService::class)->issue($booking);
    }

    public function test_every_status_short_of_confirmed_yields_no_tickets_through_any_endpoint(): void
    {
        $booking = $this->reserve();
        $this->submit($booking)->assertCreated();
        $this->as($this->customer)->getJson('/api/v1/tickets')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame(0, Ticket::count());
    }

    public function test_tokens_are_random_unique_and_only_their_hash_is_usable_from_the_database(): void
    {
        $booking = $this->confirmed();
        $tickets = Ticket::where('booking_id', $booking->id)->get();

        $this->assertCount(2, $tickets);
        $this->assertCount(2, $tickets->pluck('token_hash')->unique());
        foreach ($tickets as $t) {
            $raw = $t->qr_token_encrypted;
            $this->assertGreaterThanOrEqual(43, strlen($raw), '256-bit token');
            $this->assertSame(hash('sha256', $raw), $t->token_hash);
            $stored = DB::table('tickets')->where('id', $t->id)->first();
            $this->assertNotSame($raw, $stored->qr_token_encrypted, 'raw token is encrypted at rest');
            $this->assertStringNotContainsString($raw, json_encode($stored));
            // Nothing predictable or personal is encoded.
            $this->assertStringNotContainsString($booking->reference, TicketIssuanceService::qrPayload($raw));
        }
        $this->assertSame(26, strlen($tickets[0]->public_id));
    }

    public function test_issuing_again_never_duplicates_tickets(): void
    {
        $booking = $this->confirmed();
        $this->assertSame(0, app(TicketIssuanceService::class)->issue($booking)->count());
        $this->assertSame(2, Ticket::count());
    }

    // --- Customer view -----------------------------------------------------------------------

    public function test_the_owner_gets_a_qr_payload_and_nobody_else_does(): void
    {
        $booking = $this->confirmed();

        $r = $this->as($this->customer)->getJson('/api/v1/tickets')->assertOk();
        $this->assertCount(2, $r->json('data'));
        $first = $r->json('data.0');
        $this->assertStringStartsWith('CINEORA1:', $first['qr']);
        $this->assertSame('valid', $first['status']);
        $this->assertContains($first['seat'], ['A1', 'A2']);
        $this->assertArrayNotHasKey('token_hash', $first);
        $this->assertStringNotContainsString('qr_token_encrypted', $r->getContent());

        $this->getJson("/api/v1/bookings/{$booking->public_id}/tickets")->assertOk()->assertJsonCount(2, 'data');

        $stranger = $this->customer();
        $this->as($stranger)->getJson('/api/v1/tickets')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/v1/bookings/{$booking->public_id}/tickets")->assertNotFound();
        $this->as($this->checker)->getJson("/api/v1/bookings/{$booking->public_id}/tickets")->assertNotFound();

        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/tickets')->assertUnauthorized();
    }

    // --- Door validation ----------------------------------------------------------------------

    public function test_a_valid_ticket_is_accepted_once_and_the_second_scan_is_rejected(): void
    {
        $booking = $this->confirmed();
        $ticket = Ticket::where('booking_id', $booking->id)->first();
        $this->travelToDoors();

        $first = $this->scan($this->qr($ticket))->assertOk();
        $this->assertSame('valid', $first->json('data.result'));
        $this->assertSame($ticket->bookingSeat->seat_label, $first->json('data.ticket.seat'));

        $second = $this->scan($this->qr($ticket))->assertOk();
        $this->assertSame('already_used', $second->json('data.result'));
        $this->assertNotNull($second->json('data.ticket.checked_in_at'));

        $this->assertSame(TicketStatus::Used, $ticket->fresh()->status);
        $this->assertSame(1, TicketCheckin::where('ticket_id', $ticket->id)->count());
        $this->assertSame(['valid', 'already_used'], TicketValidationEvent::orderBy('id')->pluck('outcome')->map->value->all());
        $this->assertSame(1, AuditLog::where('action', 'ticket.checked_in')->count());

        // The other seat of the same booking is a separate ticket and still admits one.
        $other = Ticket::where('booking_id', $booking->id)->whereKeyNot($ticket->id)->first();
        $this->assertSame('valid', $this->scan($this->qr($other))->json('data.result'));
        Carbon::setTestNow();
    }

    public function test_the_response_for_a_door_check_contains_nothing_about_the_customer_or_payment(): void
    {
        $booking = $this->confirmed();
        $this->travelToDoors();
        $r = $this->scan($this->qr(Ticket::where('booking_id', $booking->id)->first()))->assertOk();

        $body = $r->getContent();
        foreach ([$this->customer->email, $this->customer->name, (string) $booking->total, 'payment', 'price', $booking->reference, 'Test Bank'] as $leak) {
            $this->assertStringNotContainsString($leak, $body, "must not leak: $leak");
        }
        $this->assertEqualsCanonicalizing(['reference', 'seat', 'category', 'movie', 'starts_at', 'room', 'checked_in_at'], array_keys($r->json('data.ticket')));
        Carbon::setTestNow();
    }

    public function test_invalid_and_malformed_codes_are_reported_as_invalid_and_logged_with_a_short_fingerprint_only(): void
    {
        $this->confirmed();
        $this->travelToDoors();
        $fake = 'CINEORA1:'.rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        foreach ([$fake, 'garbage', 'CINEORA1:', str_repeat('A', 200), "'; DROP TABLE tickets;--", '<script>'] as $code) {
            $this->scan($code)->assertOk()->assertJsonPath('data.result', 'invalid')->assertJsonMissingPath('data.ticket');
        }
        $this->assertSame(6, TicketValidationEvent::where('outcome', 'invalid')->count());
        $this->assertSame(0, Ticket::where('status', 'used')->count());
        foreach (TicketValidationEvent::whereNotNull('token_fingerprint')->pluck('token_fingerprint') as $fp) {
            $this->assertSame(8, strlen($fp));
        }
        Carbon::setTestNow();
    }

    public function test_a_checker_cannot_admit_tickets_of_a_cinema_they_are_not_assigned_to(): void
    {
        $booking = $this->confirmed();
        $this->travelToDoors();
        $outsider = $this->staff(Role::TicketChecker);
        $outsider->cinemas()->attach(Cinema::factory()->create());
        $outsider->flushAccessCache();
        $ticket = Ticket::where('booking_id', $booking->id)->first();

        $r = $this->scan($this->qr($ticket), $outsider)->assertOk();
        $this->assertSame('invalid', $r->json('data.result'), 'indistinguishable from an unknown ticket');
        $this->assertSame(TicketStatus::Valid, $ticket->fresh()->status);

        $manual = $this->as($outsider)->postJson('/api/v1/admin/tickets/validate', ['reference' => $ticket->public_id])->assertOk();
        $this->assertSame('invalid', $manual->json('data.result'));
        Carbon::setTestNow();
    }

    public function test_only_staff_with_the_scan_permission_may_validate(): void
    {
        $booking = $this->confirmed();
        $ticket = Ticket::where('booking_id', $booking->id)->first();
        $this->travelToDoors();

        foreach ([$this->customer, $this->verifier, $this->staff(Role::ContentManager), $this->staff(Role::CinemaManager)] as $user) {
            $this->scan($this->qr($ticket), $user)->assertForbidden();
        }
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/admin/tickets/validate', ['code' => $this->qr($ticket)])->assertUnauthorized();
        $this->assertSame(TicketStatus::Valid, $ticket->fresh()->status);
        $this->scan($this->qr($ticket), $this->staff(Role::SuperAdmin))->assertJsonPath('data.result', 'valid');
        Carbon::setTestNow();
    }

    public function test_wrong_showtime_and_closed_check_in_window(): void
    {
        $booking = $this->confirmed();
        $ticket = Ticket::where('booking_id', $booking->id)->first();

        // Hours before doors open.
        $this->scan($this->qr($ticket))->assertJsonPath('data.result', 'wrong_showtime');

        $this->travelToDoors();
        $this->scan($this->qr($ticket), null, ['showtime' => str_repeat('0', 26)])->assertJsonPath('data.result', 'wrong_showtime');
        $this->scan($this->qr($ticket), null, ['showtime' => $this->showtime->public_id])->assertJsonPath('data.result', 'valid');

        // After the film ended, a fresh ticket cannot be used either.
        $other = Ticket::where('booking_id', $booking->id)->whereKeyNot($ticket->id)->first();
        Carbon::setTestNow($this->showtime->fresh()->ends_at->copy()->addMinute());
        $this->scan($this->qr($other))->assertJsonPath('data.result', 'wrong_showtime');
        $this->assertSame(TicketStatus::Valid, $other->fresh()->status);
        Carbon::setTestNow();
    }

    public function test_cancelled_refunded_void_and_unconfirmed_tickets_are_refused_with_the_right_reason(): void
    {
        $booking = $this->confirmed();
        $tickets = Ticket::where('booking_id', $booking->id)->get();
        $this->travelToDoors();

        foreach ([[TicketStatus::Cancelled, 'cancelled'], [TicketStatus::Refunded, 'refunded'], [TicketStatus::Void, 'void']] as $i => [$status, $expected]) {
            $t = $tickets[$i % 2];
            $t->forceFill(['status' => $status])->save();
            $this->scan($this->qr($t))->assertJsonPath('data.result', $expected);
            $this->assertNull(TicketCheckin::where('ticket_id', $t->id)->first());
        }

        // A valid ticket on a booking that is no longer confirmed is also refused.
        $tickets[0]->forceFill(['status' => TicketStatus::Valid])->save();
        $booking->forceFill(['status' => BookingStatus::REFUND_PENDING])->save();
        $this->scan($this->qr($tickets[0]))->assertJsonPath('data.result', 'void');
        Carbon::setTestNow();
    }

    public function test_manual_lookup_by_ticket_reference_works_and_is_equally_strict(): void
    {
        $booking = $this->confirmed();
        $ticket = Ticket::where('booking_id', $booking->id)->first();
        $this->travelToDoors();

        $this->as($this->checker)->postJson('/api/v1/admin/tickets/validate', ['reference' => strtolower($ticket->public_id)])->assertJsonPath('data.result', 'valid');
        $this->postJson('/api/v1/admin/tickets/validate', ['reference' => $ticket->public_id])->assertJsonPath('data.result', 'already_used');
        $this->postJson('/api/v1/admin/tickets/validate', ['reference' => $booking->reference])->assertJsonPath('data.result', 'invalid');
        $this->postJson('/api/v1/admin/tickets/validate', [])->assertStatus(422);
        Carbon::setTestNow();
    }

    public function test_checker_activity_list_is_limited_to_their_own_attempts(): void
    {
        $booking = $this->confirmed();
        $this->travelToDoors();
        $this->scan($this->qr(Ticket::where('booking_id', $booking->id)->first()))->assertOk();
        $this->scan('garbage')->assertOk();

        $mine = $this->as($this->checker)->getJson('/api/v1/admin/tickets/recent')->assertOk()->json('data');
        $this->assertSame(['invalid', 'valid'], array_column($mine, 'outcome'));

        $other = $this->staff(Role::TicketChecker);
        $this->as($other)->getJson('/api/v1/admin/tickets/recent')->assertOk()->assertJsonCount(0, 'data');
        $this->as($this->customer)->getJson('/api/v1/admin/tickets/recent')->assertForbidden();
        Carbon::setTestNow();
    }

    // --- Refunds ----------------------------------------------------------------------------------

    public function test_refund_request_voids_tickets_and_a_denial_restores_them(): void
    {
        $booking = $this->confirmed();
        $admin = $this->staff(Role::SuperAdmin);

        $this->as($this->customer)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'x'])->assertStatus(422);
        $id = $this->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'I cannot attend any more'])->assertCreated()->json('data.id');

        $this->assertSame(BookingStatus::REFUND_PENDING, $booking->fresh()->status);
        $this->assertSame(2, Ticket::where('booking_id', $booking->id)->where('status', 'void')->count());
        $this->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'asking twice again'])->assertStatus(409);

        // While open, the ticket does not admit anyone.
        $this->travelToDoors();
        $t = Ticket::where('booking_id', $booking->id)->first();
        $this->assertSame('void', $this->scan($this->qr($t))->json('data.result'));
        Carbon::setTestNow();

        $this->as($this->verifier)->postJson("/api/v1/admin/refunds/{$id}/deny", ['reason' => 'not eligible'])->assertForbidden();
        $this->as($admin)->postJson("/api/v1/admin/refunds/{$id}/deny", ['reason' => 'Non-refundable promotion'])->assertOk()->assertJsonPath('data.status', 'denied');
        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);
        $this->assertSame(2, Ticket::where('booking_id', $booking->id)->where('status', 'valid')->count());
        $this->postJson("/api/v1/admin/refunds/{$id}/deny", ['reason' => 'again for good measure'])->assertStatus(409);
    }

    public function test_a_paid_refund_refunds_the_tickets_and_puts_the_seats_back_on_sale(): void
    {
        $booking = $this->confirmed();
        $id = $this->as($this->customer)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'plans changed for me'])->json('data.id');

        $admin = $this->staff(Role::SuperAdmin);
        $this->as($admin)->postJson("/api/v1/admin/refunds/{$id}/pay", [])->assertStatus(422);
        $this->postJson("/api/v1/admin/refunds/{$id}/pay", ['reference' => 'KB-20261108-001'])->assertOk()->assertJsonPath('data.status', 'paid');

        $this->assertSame(BookingStatus::REFUNDED, $booking->fresh()->status);
        $this->assertSame(2, Ticket::where('booking_id', $booking->id)->where('status', 'refunded')->count());
        $this->assertSame(1, DB::table('refund_transactions')->count());
        $this->assertSame('KB-20261108-001', DB::table('refund_transactions')->value('reference'));
        $this->book($this->customer(), ['A1', 'A2'])->assertCreated();
        $this->as($admin)->postJson("/api/v1/admin/refunds/{$id}/pay", ['reference' => 'KB-AGAIN-002'])->assertStatus(409);
        $this->assertSame(1, DB::table('refund_transactions')->count(), 'a refund cannot be paid out twice');
    }

    public function test_refund_rules_window_ownership_and_used_tickets(): void
    {
        $booking = $this->confirmed();
        $stranger = $this->customer();
        $this->as($stranger)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'not even my booking'])->assertNotFound();

        $this->travelToDoors(); // 30 minutes before the show: inside the 2 hour cut-off
        $this->as($this->customer)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'too late but trying'])->assertStatus(409)->assertJson(['code' => 'refund_window_closed']);
        Carbon::setTestNow();

        $this->scanAtDoors(Ticket::where('booking_id', $booking->id)->first());
        $this->as($this->customer)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'one ticket already used'])->assertStatus(409);
        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);

        $pending = $this->reserve($this->customer(), ['B1']);
        $this->as($pending->user)->postJson("/api/v1/bookings/{$pending->public_id}/refund-request", ['reason' => 'never paid at all'])->assertStatus(409)->assertJson(['code' => 'not_refundable']);
    }

    private function scanAtDoors(Ticket $ticket): void
    {
        $this->travelToDoors();
        $this->scan($this->qr($ticket))->assertJsonPath('data.result', 'valid');
        Carbon::setTestNow();
    }

    public function test_refund_queue_is_limited_to_authorised_staff(): void
    {
        $booking = $this->confirmed();
        $this->as($this->customer)->postJson("/api/v1/bookings/{$booking->public_id}/refund-request", ['reason' => 'queue visibility check'])->assertCreated();

        $this->as($this->verifier)->getJson('/api/v1/admin/refunds')->assertForbidden();
        $this->as($this->checker)->getJson('/api/v1/admin/refunds')->assertForbidden();
        $this->as($this->customer)->getJson('/api/v1/admin/refunds')->assertForbidden();
        $this->as($this->staff(Role::SuperAdmin))->getJson('/api/v1/admin/refunds')->assertOk()->assertJsonCount(1, 'data');
    }
}
