<?php

namespace Tests\Feature\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\OutboxMessage;
use App\Models\Payment;
use App\Models\RefundRequest;
use App\Models\ShowtimeSeat;
use App\Models\Ticket;
use App\Services\Booking\BookingExpiryService;
use App\Services\Payment\PaymentExceptionService;
use Illuminate\Support\Carbon;

class PaymentReviewTest extends PaymentTestCase
{
    private function verify(Payment $p, $user = null, array $body = [])
    {
        return $this->as($user ?? $this->verifier)->postJson("/api/v1/admin/payments/{$p->public_id}/verify", $body);
    }

    // --- Verify ---------------------------------------------------------------------

    public function test_verifying_confirms_the_booking_sells_the_seats_and_issues_one_ticket_per_seat(): void
    {
        [$booking, $payment] = $this->inReview();

        $this->verify($payment, null, ['notes' => 'matches statement'])->assertOk()->assertJsonPath('data.status', 'VERIFIED');

        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);
        $this->assertNotNull($booking->fresh()->confirmed_at);
        $this->assertSame(PaymentStatus::VERIFIED, $payment->fresh()->status);
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'sold')->count());
        $this->assertSame(0, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'held')->count());
        $this->assertSame(2, Ticket::where('booking_id', $booking->id)->where('status', 'valid')->count());
        $this->assertEqualsCanonicalizing(['A1', 'A2'], Ticket::where('booking_id', $booking->id)->with('bookingSeat')->get()->pluck('bookingSeat.seat_label')->all());

        $review = $payment->reviews()->firstOrFail();
        $this->assertSame([$this->verifier->id, 'verified', 'matches statement'], [$review->reviewer_id, $review->decision->value, $review->internal_notes]);
        $this->assertSame(['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED'], $booking->histories()->orderBy('id')->pluck('to_status')->all());
        $this->assertSame(1, AuditLog::where('action', 'payment.verified')->count());
        $this->assertSame(1, OutboxMessage::where('type', 'booking.confirmed')->count());

        // The seats are sold: nobody else can take them, and the expiry job never touches them.
        $this->book($this->customer(), ['A1'])->assertStatus(409);
        Carbon::setTestNow(now()->addDay());
        $this->assertSame(0, app(BookingExpiryService::class)->expireDue());
        Carbon::setTestNow();
    }

    public function test_a_payment_can_only_be_verified_once_and_never_creates_extra_tickets(): void
    {
        [, $payment] = $this->inReview();
        $this->verify($payment)->assertOk();

        $this->verify($payment)->assertStatus(409)->assertJson(['code' => 'invalid_state']);
        $this->verify($payment, $this->staff(Role::SuperAdmin))->assertStatus(409);
        $this->assertSame(2, Ticket::count());
        $this->assertSame(1, $payment->reviews()->count());
    }

    public function test_customers_can_never_verify_anything_including_their_own_payment(): void
    {
        [$booking, $payment] = $this->inReview();

        $this->verify($payment, $this->customer)->assertForbidden();
        $this->verify($payment, $this->customer())->assertForbidden();
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $booking->fresh()->status);
        $this->assertSame(0, Ticket::count());
    }

    public function test_a_verifier_cannot_approve_their_own_booking_or_a_proof_they_submitted(): void
    {
        // The verifier books and pays for seats themselves.
        [$own, $ownPayment] = $this->inReview($this->verifier, ['B1', 'B2'], 21);
        $this->verify($ownPayment)->assertForbidden();
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $own->fresh()->status);

        // Even a different verifier-role user is refused for a proof the first one submitted on someone's behalf.
        [$other, $otherPayment] = $this->inReview($this->customer(), ['A3'], 22);
        $otherPayment->forceFill(['submitted_by' => $this->verifier->id])->save();
        $this->verify($otherPayment)->assertForbidden();
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $other->fresh()->status);

        $second = $this->staff(Role::PaymentVerifier);
        $second->cinemas()->attach($this->cinema);
        $second->flushAccessCache();
        $this->verify($otherPayment, $second)->assertOk();
    }

    public function test_only_verifiers_for_the_payments_cinema_and_authorised_roles_may_decide(): void
    {
        [, $payment] = $this->inReview();
        $other = $this->staff(Role::PaymentVerifier);
        $other->cinemas()->attach(\App\Models\Cinema::factory()->create());
        $other->flushAccessCache();

        foreach ([$other, $this->staff(Role::TicketChecker), $this->staff(Role::CinemaManager), $this->staff(Role::ContentManager)] as $user) {
            $this->verify($payment, $user)->assertForbidden();
            $this->as($user)->postJson("/api/v1/admin/payments/{$payment->public_id}/reject", ['reason' => 'blurry image please'])->assertForbidden();
        }
        $this->assertSame(PaymentStatus::PROOF_SUBMITTED, $payment->fresh()->status);
        $this->verify($payment, $this->staff(Role::SuperAdmin))->assertOk();
    }

    public function test_a_different_amount_cannot_be_verified(): void
    {
        $booking = $this->reserve();
        $this->submit($booking, null, ['submitted_amount' => 20000])->assertCreated();
        $payment = $booking->payments()->first();

        $this->verify($payment)->assertStatus(409)->assertJson(['code' => 'amount_mismatch']);
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $booking->fresh()->status);
        $this->assertSame(0, Ticket::count());
        $this->assertFalse((bool) $this->as($this->verifier)->getJson("/api/v1/admin/payments/{$payment->public_id}")->json('data.amount_matches'));
    }

    public function test_verification_fails_if_the_seats_are_no_longer_the_bookings(): void
    {
        [$booking, $payment] = $this->inReview();
        ShowtimeSeat::where('booking_id', $booking->id)->limit(1)->update(['booking_id' => null, 'status' => 'available']);

        $this->verify($payment)->assertStatus(409)->assertJson(['code' => 'seats_lost']);
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $booking->fresh()->status);
        $this->assertSame(0, Ticket::count());
    }

    public function test_verifying_after_the_deadline_never_approves_it_quietly(): void
    {
        [$booking, $payment] = $this->inReview();
        Carbon::setTestNow($booking->payment_deadline_at->copy()->addSeconds(30));

        $this->verify($payment)->assertStatus(409)->assertJson(['code' => 'deadline_passed']);

        $this->assertSame(BookingStatus::PAYMENT_EXCEPTION, $booking->fresh()->status);
        $this->assertSame(PaymentStatus::EXCEPTION, $payment->fresh()->status);
        $this->assertSame(0, Ticket::count());
        Carbon::setTestNow();
    }

    // --- Reject / resubmit -------------------------------------------------------------

    public function test_rejection_needs_a_reason_keeps_the_seats_and_allows_one_resubmission(): void
    {
        [$booking, $payment] = $this->inReview();
        $reject = fn ($body) => $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/reject", $body);

        $reject([])->assertStatus(422)->assertJsonValidationErrors('reason');
        $reject(['reason' => 'no'])->assertStatus(422);
        $this->assertSame(PaymentStatus::PROOF_SUBMITTED, $payment->fresh()->status);

        $reject(['reason' => 'Amount on the slip is unreadable', 'notes' => 'internal: looks edited'])->assertOk()->assertJsonPath('data.status', 'REJECTED');
        $this->assertSame(BookingStatus::PAYMENT_REJECTED, $booking->fresh()->status);
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'held')->count(), 'seats stay held for a resubmission');
        $this->assertSame(0, Ticket::count());
        $this->assertSame(1, OutboxMessage::where('type', 'payment.rejected')->count());

        // The customer sees the reason but never the internal note or the reviewer.
        $view = $this->as($this->customer)->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertOk();
        $this->assertSame('Amount on the slip is unreadable', $view->json('data.rejection_reason'));
        $this->assertStringNotContainsString('looks edited', $view->getContent());
        $this->assertStringNotContainsString($this->verifier->name, $view->getContent());

        // A rejected payment cannot be flipped to verified later.
        $this->verify($payment)->assertStatus(409);

        // Resubmit: a new payment row, back in review.
        $this->submit($booking, null, [], $this->png(99))->assertCreated();
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $booking->fresh()->status);
        $this->assertSame(2, Payment::where('booking_id', $booking->id)->count());
        $this->assertSame(1, Payment::where('booking_id', $booking->id)->where('status', 'PROOF_SUBMITTED')->count());
        $newPayment = $booking->payments()->where('status', 'PROOF_SUBMITTED')->first();
        $this->verify($newPayment)->assertOk();
        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);
        $this->assertSame(2, $payment->reviews()->count() + $newPayment->reviews()->count() + 0);
    }

    public function test_a_rejected_booking_expires_at_the_payment_deadline_and_releases_its_seats(): void
    {
        [$booking, $payment] = $this->inReview();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/reject", ['reason' => 'wrong account number used'])->assertOk();

        Carbon::setTestNow($booking->payment_deadline_at->copy()->addSecond());
        $this->assertSame(1, app(BookingExpiryService::class)->expireDue());
        $this->assertSame(BookingStatus::EXPIRED, $booking->fresh()->status);
        $this->assertSame(0, ShowtimeSeat::where('booking_id', $booking->id)->count());
        $this->submit($booking, null, [], $this->png(5))->assertStatus(409);
        Carbon::setTestNow();
    }

    // --- Deadline / exceptions -----------------------------------------------------------

    public function test_unreviewed_proofs_at_the_deadline_move_to_the_exception_queue_and_keep_their_seats(): void
    {
        [$booking, $payment] = $this->inReview();
        Carbon::setTestNow($booking->payment_deadline_at->copy()->addMinutes(1));

        // Before any job runs, the lapsed clock must not make the seats available to someone else.
        $this->book($this->customer(), ['A1'])->assertStatus(409);
        $this->assertSame('held', collect($this->getJson("/api/v1/showtimes/{$this->showtime->public_id}/seats")->json('data.seats'))->firstWhere('key', 'A1')['status']);

        $this->assertSame(1, app(PaymentExceptionService::class)->detectDue());
        $this->assertSame(0, app(PaymentExceptionService::class)->detectDue(), 'idempotent');
        $this->assertSame(BookingStatus::PAYMENT_EXCEPTION, $booking->fresh()->status);
        $this->assertSame(PaymentStatus::EXCEPTION, $payment->fresh()->status);

        // Neither the expiry job nor another customer can take the seats; they are protected until the show.
        $this->assertSame(0, app(BookingExpiryService::class)->expireDue());
        $this->book($this->customer(), ['A1', 'A2'])->assertStatus(409);
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'held')->count());
        $this->assertTrue(ShowtimeSeat::where('booking_id', $booking->id)->first()->hold_expires_at->equalTo($this->showtime->starts_at));
        $this->assertSame(0, Ticket::count());
        $this->assertSame(1, OutboxMessage::where('type', 'payment.exception')->count());
        Carbon::setTestNow();
    }

    public function test_a_verifier_can_hand_a_problem_proof_to_the_exception_queue(): void
    {
        [$booking, $payment] = $this->inReview();

        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", [])->assertStatus(422);
        $this->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", ['reason' => 'paid from a third party account'])->assertOk();

        $this->assertSame(BookingStatus::PAYMENT_EXCEPTION, $booking->fresh()->status);
        $this->assertSame('exception', $payment->reviews()->first()->decision->value);
        $this->verify($payment)->assertStatus(409); // a verifier cannot settle it any more
    }

    public function test_only_administrators_resolve_exceptions_and_confirmation_requires_intact_seats(): void
    {
        [$booking, $payment] = $this->inReview();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", ['reason' => 'third party payer'])->assertOk();
        $resolve = fn ($user, $body) => $this->as($user)->postJson("/api/v1/admin/payments/{$payment->public_id}/resolve", $body);

        $resolve($this->verifier, ['action' => 'confirm', 'note' => 'looks fine to me'])->assertForbidden();
        $resolve($this->customer, ['action' => 'confirm', 'note' => 'please let me in'])->assertForbidden();
        $admin = $this->staff(Role::SuperAdmin);
        $resolve($admin, ['action' => 'confirm'])->assertStatus(422);
        $resolve($admin, ['action' => 'launder', 'note' => 'whatever you say'])->assertStatus(422);

        // Seats lost in the meantime: confirmation is refused, never forced.
        ShowtimeSeat::where('booking_id', $booking->id)->limit(1)->update(['booking_id' => null, 'status' => 'available']);
        $resolve($admin, ['action' => 'confirm', 'note' => 'money arrived, checked bank'])->assertStatus(409)->assertJson(['code' => 'seats_lost']);
        $this->assertSame(0, Ticket::count());
    }

    public function test_administrator_confirms_an_exception_when_the_seats_are_intact(): void
    {
        [$booking, $payment] = $this->inReview();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", ['reason' => 'third party payer'])->assertOk();

        $this->as($this->staff(Role::SuperAdmin))->postJson("/api/v1/admin/payments/{$payment->public_id}/resolve", ['action' => 'confirm', 'note' => 'called the customer, money matches'])->assertOk();

        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);
        $this->assertSame(2, Ticket::count());
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'sold')->count());
        $this->assertSame(1, AuditLog::where('action', 'payment.exception_resolved')->count());
    }

    public function test_a_mismatched_amount_in_an_exception_needs_explicit_acknowledgement(): void
    {
        $booking = $this->reserve();
        $this->submit($booking, null, ['submitted_amount' => 30000])->assertCreated();
        $payment = $booking->payments()->first();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", ['reason' => 'overpaid, needs a decision'])->assertOk();
        $admin = $this->staff(Role::SuperAdmin);

        $this->as($admin)->postJson("/api/v1/admin/payments/{$payment->public_id}/resolve", ['action' => 'confirm', 'note' => 'accept the overpayment'])->assertStatus(409)->assertJson(['code' => 'amount_mismatch']);
        $this->postJson("/api/v1/admin/payments/{$payment->public_id}/resolve", ['action' => 'confirm', 'note' => 'accept the overpayment', 'acknowledge_amount_difference' => true])->assertOk();
        $this->assertSame(BookingStatus::CONFIRMED, $booking->fresh()->status);
    }

    public function test_cancelling_an_exception_queues_a_refund_and_releases_the_seats(): void
    {
        [$booking, $payment] = $this->inReview();
        $this->as($this->verifier)->postJson("/api/v1/admin/payments/{$payment->public_id}/exception", ['reason' => 'seats were double sold'])->assertOk();
        $admin = $this->staff(Role::SuperAdmin);

        $this->as($admin)->postJson("/api/v1/admin/payments/{$payment->public_id}/resolve", ['action' => 'cancel', 'note' => 'cannot honour this seating'])->assertOk();

        $this->assertSame(BookingStatus::REFUND_PENDING, $booking->fresh()->status);
        $refund = RefundRequest::where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame([24000, 'pending'], [(int) $refund->amount, $refund->status->value]);
        $this->assertSame(0, ShowtimeSeat::where('booking_id', $booking->id)->count());
        $this->book($this->customer(), ['A1', 'A2'])->assertCreated();

        // Such a refund cannot be "denied" (the booking cannot come back); it is paid out.
        $this->as($admin)->postJson("/api/v1/admin/refunds/{$refund->public_id}/deny", ['reason' => 'changed our mind'])->assertStatus(409)->assertJson(['code' => 'cannot_deny']);
        $this->postJson("/api/v1/admin/refunds/{$refund->public_id}/pay", ['reference' => 'BANK-REF-1'])->assertOk();
        $this->assertSame(BookingStatus::REFUNDED, $booking->fresh()->status);
        $this->assertSame(PaymentStatus::REFUNDED, $payment->fresh()->status);
    }

    // --- Queue / listing ---------------------------------------------------------------------

    public function test_review_queue_is_scoped_filtered_and_hides_customer_identity_from_verifiers(): void
    {
        [, $payment] = $this->inReview();
        $elsewhere = \App\Models\Cinema::factory()->create();
        $other = $this->staff(Role::PaymentVerifier);
        $other->cinemas()->attach($elsewhere);
        $other->flushAccessCache();

        $r = $this->as($this->verifier)->getJson('/api/v1/admin/payments?queue=pending')->assertOk();
        $this->assertSame([$payment->public_id], array_column($r->json('data'), 'id'));
        $this->assertNull($r->json('data.0.customer'), 'a payment verifier does not get the customer\'s name or email');
        $this->assertSame(['A1', 'A2'], $r->json('data.0.booking.seats'));
        $this->assertArrayNotHasKey('path', $r->json('data.0.proofs.0'));

        $this->assertSame([], $this->as($other)->getJson('/api/v1/admin/payments')->json('data'));
        $this->as($other)->getJson("/api/v1/admin/payments/{$payment->public_id}")->assertForbidden();

        $admin = $this->as($this->staff(Role::SuperAdmin))->getJson('/api/v1/admin/payments?q='.substr($payment->booking->reference, 0, 6))->assertOk();
        $this->assertCount(1, $admin->json('data'));
        $this->assertSame($this->customer->email, $admin->json('data.0.customer.email'));
        $this->getJson('/api/v1/admin/payments?queue=exceptions')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/payments?status=hacked')->assertStatus(422);
        $this->as($this->customer)->getJson('/api/v1/admin/payments')->assertForbidden();
    }

    public function test_review_history_is_append_only_for_the_application(): void
    {
        [, $payment] = $this->inReview();
        $this->verify($payment)->assertOk();
        $review = $payment->reviews()->firstOrFail();

        $this->assertNull($review->updated_at ?? null);
        $this->assertSame(1, $payment->reviews()->count());
        // There is deliberately no route that edits or deletes a review.
        $routes = collect(app('router')->getRoutes()->getRoutes())->filter(fn ($r) => str_contains($r->uri(), 'review'))->count();
        $this->assertSame(0, $routes);
    }

    public function test_bank_accounts_are_managed_only_by_authorised_staff_and_never_audited_in_full(): void
    {
        $payload = ['bank_name' => 'New Bank', 'account_name' => 'Cineora Ltd', 'account_number' => '999-888-777666', 'swift' => 'NEWBKRSE'];

        $this->as($this->verifier)->postJson('/api/v1/admin/bank-accounts', $payload)->assertForbidden();
        $this->getJson('/api/v1/admin/bank-accounts')->assertForbidden();
        $this->as($this->customer)->getJson('/api/v1/admin/bank-accounts')->assertForbidden();

        $admin = $this->staff(Role::SuperAdmin);
        $id = $this->as($admin)->postJson('/api/v1/admin/bank-accounts', $payload)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/admin/bank-accounts', ['bank_name' => 'x'])->assertStatus(422);
        $this->postJson('/api/v1/admin/bank-accounts', [...$payload, 'account_number' => '<script>'])->assertStatus(422);
        $this->patchJson("/api/v1/admin/bank-accounts/{$id}", ['account_number' => '111-222-333444', 'is_active' => false])->assertOk();

        $audit = AuditLog::whereIn('action', ['bank_account.created', 'bank_account.updated'])->get()->map(fn ($l) => json_encode($l->metadata))->implode('|');
        $this->assertStringNotContainsString('999-888', $audit);
        $this->assertStringNotContainsString('111-222', $audit);
        $this->assertStringContainsString('account_number', $audit, 'the fact that it changed is recorded');
        $this->assertStringNotContainsString('999-888-777666', (string) \DB::table('bank_accounts')->where('bank_name', 'New Bank')->value('account_number'));
    }
}
