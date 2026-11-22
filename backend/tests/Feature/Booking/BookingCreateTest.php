<?php

namespace Tests\Feature\Booking;

use App\Enums\BookingStatus;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\ScreeningRoom;
use App\Models\Seat;
use App\Models\SeatHold;
use App\Models\ShowtimeSeat;
use Illuminate\Support\Carbon;

class BookingCreateTest extends BookingTestCase
{
    public function test_creates_a_pending_booking_with_server_prices_snapshots_holds_and_history(): void
    {
        $user = $this->customer();

        $r = $this->book($user, ['A1', 'B1'])->assertCreated();

        $b = Booking::where('public_id', $r->json('data.id'))->firstOrFail();
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $b->status);
        $this->assertSame($user->id, $b->user_id);
        $this->assertSame([28000, 28000, 0, 0], [(int) $b->subtotal, (int) $b->total, (int) $b->discount, (int) $b->fee]);
        $this->assertSame('KRW', $b->currency);
        $this->assertMatchesRegularExpression('/^CIN-[A-HJ-NP-Z2-9]{8}$/', $b->reference);
        $this->assertSame((int) config('cineora.booking.seat_hold_minutes'), (int) $b->created_at->diffInMinutes($b->hold_expires_at, true));
        $this->assertSame((int) config('cineora.booking.payment_deadline_minutes'), (int) $b->created_at->diffInMinutes($b->payment_deadline_at, true));

        $this->assertEqualsCanonicalizing(['A1', 'B1'], $b->seats()->pluck('seat_label')->all());
        $this->assertSame([12000, 16000], $b->seats()->orderBy('unit_price')->pluck('unit_price')->map(fn ($p) => (int) $p)->all());
        $this->assertSame(2, SeatHold::where('booking_id', $b->id)->count());
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $b->id)->where('status', 'held')->count());
        $this->assertSame([[null, 'PENDING_PAYMENT']], $b->histories()->get()->map(fn ($h) => [$h->from_status, $h->to_status])->all());
        $this->assertSame(1, AuditLog::where('action', 'booking.created')->where('actor_id', $user->id)->count());
        $this->assertSame('false', $r->headers->get('Idempotent-Replayed'));
        $this->assertNotEmpty($r->json('meta.server_now'));
        $this->assertSame(['A1', 'B1'], array_column($r->json('data.seats'), 'label'));
        // Nothing internal leaks.
        $this->assertArrayNotHasKey('user_id', $r->json('data'));
        $this->assertArrayNotHasKey('showtime_id', $r->json('data'));
    }

    public function test_client_supplied_prices_totals_status_and_owner_are_ignored(): void
    {
        $user = $this->customer();
        $other = $this->customer();

        $r = $this->book($user, ['A1'], null, [
            'price' => 1, 'total' => 1, 'subtotal' => 1, 'unit_price' => 1, 'discount' => 99999, 'fee' => -5,
            'status' => 'CONFIRMED', 'user_id' => $other->id, 'cinema_id' => 999, 'hold_expires_at' => '2099-01-01',
            'seats_detail' => [['label' => 'A1', 'price' => 1]],
        ])->assertCreated();

        $b = Booking::where('public_id', $r->json('data.id'))->first();
        $this->assertSame(12000, (int) $b->total);
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $b->status);
        $this->assertSame($user->id, $b->user_id);
        $this->assertSame($this->cinema->id, $b->cinema_id);
        $this->assertTrue($b->hold_expires_at->lte(now()->addMinutes((int) config('cineora.booking.seat_hold_minutes'))));
    }

    public function test_admin_price_change_after_booking_cannot_alter_the_historic_price(): void
    {
        $r = $this->book($this->customer(), ['A1'])->assertCreated();
        $b = Booking::where('public_id', $r->json('data.id'))->first();
        // Prices are frozen while a booking is live...
        $this->as($this->staff(\App\Enums\Role::SuperAdmin))->putJson("/api/v1/admin/showtimes/{$this->showtime->public_id}/prices", ['prices' => $this->prices(1, 1)])->assertStatus(409);
        // ...and even a direct inventory change never touches the booked snapshot.
        ShowtimeSeat::query()->update(['price' => 1]);
        $this->assertSame(12000, (int) $b->seats()->first()->unit_price);
        $this->assertSame(12000, (int) $b->fresh()->total);
    }

    public function test_service_fee_is_added_per_seat_from_server_config(): void
    {
        config(['cineora.booking.service_fee_per_seat' => 1000]);
        $r = $this->book($this->customer(), ['A1', 'A2'])->assertCreated();
        $this->assertSame([24000, 2000, 26000], [$r->json('data.subtotal'), $r->json('data.fee'), $r->json('data.total')]);
    }

    public function test_taken_seats_are_refused_atomically_and_reported(): void
    {
        $first = $this->customer();
        $second = $this->customer();
        $this->book($first, ['A1'])->assertCreated();

        $r = $this->book($second, ['A1', 'A2'])->assertStatus(409);
        $r->assertJson(['success' => false, 'code' => 'seats_unavailable', 'errors' => ['seats' => ['A1']]]);

        $this->assertSame(0, Booking::where('user_id', $second->id)->count());
        $a2 = ShowtimeSeat::whereHas('seat', fn ($s) => $s->where('row_label', 'A')->where('number', 2))->first();
        $this->assertSame('available', $a2->status->value, 'a failed request must not hold the seats that were free');
        $this->assertSame(1, SeatHold::whereNull('released_at')->count());
    }

    public function test_sold_blocked_and_inactive_seats_cannot_be_booked(): void
    {
        $seats = fn (string $label) => ShowtimeSeat::whereHas('seat', fn ($s) => $s->where('row_label', $label[0])->where('number', (int) substr($label, 1)))->first();
        $seats('A1')->update(['status' => 'sold']);
        $seats('A2')->update(['status' => 'blocked']);
        $seats('A3')->seat->update(['is_active' => false]);
        $user = $this->customer();

        foreach (['A1', 'A2', 'A3'] as $label) {
            $this->book($user, [$label])->assertStatus(409)->assertJsonPath('errors.seats.0', $label);
        }
        $this->book($user, ['A4'])->assertCreated();
    }

    public function test_a_lapsed_hold_can_be_taken_over_and_the_old_booking_cannot_release_the_new_owners_seat(): void
    {
        $slow = $this->customer();
        $fast = $this->customer();
        $old = Booking::where('public_id', $this->book($slow, ['A1', 'A2'])->json('data.id'))->first();

        Carbon::setTestNow(now()->addMinutes((int) config('cineora.booking.seat_hold_minutes') + 1));
        $this->book($fast, ['A1'])->assertCreated();
        $taken = ShowtimeSeat::whereHas('seat', fn ($s) => $s->where('row_label', 'A')->where('number', 1))->first();
        $this->assertNotSame($old->id, $taken->booking_id);

        // The stale booking is cleaned up later; that must leave the new owner's seat alone.
        app(\App\Services\Booking\BookingExpiryService::class)->expireDue();
        $this->assertSame(BookingStatus::EXPIRED, $old->fresh()->status);
        $this->assertSame('held', $taken->fresh()->status->value);
        $this->assertSame(1, BookingSeat::whereNull('released_at')->count());
        $this->assertSame('available', ShowtimeSeat::whereHas('seat', fn ($s) => $s->where('row_label', 'A')->where('number', 2))->first()->status->value);
        Carbon::setTestNow();
    }

    public function test_input_validation(): void
    {
        $user = $this->customer();
        $this->book($user, [])->assertStatus(422);
        $this->book($user, ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'C1', 'C2', 'C3'])->assertStatus(422);
        $this->book($user, ['A1;DROP'])->assertStatus(422);
        $this->book($user, ['1A'])->assertStatus(422);
        $this->book($user, [['label' => 'A1']])->assertStatus(422);
        $this->book($user, ['Z9'])->assertStatus(422)->assertJsonValidationErrors('seats');
        $this->as($user)->postJson('/api/v1/bookings', ['showtime' => $this->showtime->public_id, 'seats' => ['A1']])->assertStatus(422)->assertJsonValidationErrors('idempotency_key');
        $this->as($user)->postJson('/api/v1/bookings', ['showtime' => $this->showtime->public_id, 'seats' => ['A1']], ['Idempotency-Key' => 'short'])->assertStatus(422);
        $this->book($user, ['A1'], null, ['showtime' => 'not-a-ulid'])->assertStatus(422);
        $this->book($user, ['A1'], null, ['showtime' => str_repeat('0', 26)])->assertNotFound();
        $this->assertSame(0, Booking::count());
    }

    public function test_duplicate_labels_in_one_request_collapse_to_one_seat(): void
    {
        $r = $this->book($this->customer(), ['A1', 'a1', ' A1 '])->assertCreated();
        $this->assertCount(1, $r->json('data.seats'));
        $this->assertSame(12000, $r->json('data.total'));
    }

    public function test_draft_started_closed_and_other_showtimes_are_not_bookable(): void
    {
        $user = $this->customer();
        $draftId = $this->as($this->staff(\App\Enums\Role::SuperAdmin))->createShowtime(['starts_at' => $this->at(10)]);
        $draft = \App\Models\Showtime::where('public_id', $draftId)->first();
        $this->book($user, ['A1'], null, [], $draft)->assertNotFound();

        $this->showtime->forceFill(['starts_at' => now()->addMinutes(10), 'sales_cutoff_minutes' => 15])->save();
        $this->book($user, ['A1'])->assertStatus(409)->assertJson(['code' => 'sales_closed']);

        $this->showtime->forceFill(['starts_at' => now()->subMinute()])->save();
        $this->book($user, ['A1'])->assertNotFound();

        $this->showtime->forceFill(['starts_at' => now()->addDay(), 'status' => 'cancelled'])->save();
        $this->book($user, ['A1'])->assertNotFound();
    }

    public function test_a_seat_label_from_another_room_cannot_be_booked(): void
    {
        $other = ScreeningRoom::factory()->create(['cinema_id' => $this->cinema->id]);
        Seat::factory()->create(['room_id' => $other->id, 'seat_category_id' => $this->standardCategory()->id, 'row_label' => 'Q', 'number' => 1]);

        $this->book($this->customer(), ['Q1'])->assertStatus(422)->assertJsonValidationErrors('seats');
    }

    public function test_authentication_and_email_verification_are_required(): void
    {
        $this->withHeaders(['Idempotency-Key' => 'abcdefgh1'])->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/bookings', ['showtime' => $this->showtime->public_id, 'seats' => ['A1']])->assertUnauthorized();

        $unverified = $this->customer(['email_verified_at' => null]);
        $this->book($unverified, ['A1'])->assertForbidden()->assertJson(['code' => 'email_unverified']);
        $this->assertSame(0, Booking::count());
    }

    public function test_unpaid_booking_limit_and_release_by_cancelling(): void
    {
        config(['cineora.booking.max_active_unpaid_bookings' => 2]);
        $user = $this->customer();
        $first = $this->book($user, ['A1'])->assertCreated()->json('data.id');
        $this->book($user, ['A2'])->assertCreated();
        $this->book($user, ['A3'])->assertStatus(409)->assertJson(['code' => 'too_many_pending']);

        $this->postJson("/api/v1/bookings/{$first}/cancel")->assertOk()->assertJsonPath('data.status', 'CANCELLED');
        $this->book($user, ['A3'])->assertCreated();
    }

    // --- Idempotency ------------------------------------------------------------

    public function test_repeating_a_request_with_the_same_key_returns_the_same_booking_without_a_second_hold(): void
    {
        $user = $this->customer();

        $a = $this->book($user, ['A1', 'A2'], 'order-0001')->assertCreated();
        $b = $this->book($user, ['A2', 'A1'], 'order-0001')->assertOk(); // seat order does not matter

        $this->assertSame($a->json('data.id'), $b->json('data.id'));
        $this->assertSame('true', $b->headers->get('Idempotent-Replayed'));
        $this->assertTrue($b->json('meta.replayed'));
        $this->assertSame(1, Booking::count());
        $this->assertSame(2, SeatHold::count());
    }

    public function test_reusing_a_key_for_a_different_request_is_rejected(): void
    {
        $user = $this->customer();
        $this->book($user, ['A1'], 'order-0002')->assertCreated();

        $this->book($user, ['A2'], 'order-0002')->assertStatus(422)->assertJsonValidationErrors('idempotency_key');
        $this->assertSame(1, Booking::count());
    }

    public function test_keys_are_scoped_per_customer(): void
    {
        $this->book($this->customer(), ['A1'], 'shared-key-1')->assertCreated();
        $this->book($this->customer(), ['A2'], 'shared-key-1')->assertCreated();
        $this->assertSame(2, Booking::count());
    }

    public function test_a_failed_attempt_does_not_burn_the_key(): void
    {
        $a = $this->customer();
        $b = $this->customer();
        $this->book($a, ['A1'])->assertCreated();

        $this->book($b, ['A1'], 'retry-key-1')->assertStatus(409);
        $this->book($b, ['A2'], 'retry-key-1')->assertCreated(); // different payload is fine because the first attempt stored nothing
    }

    // --- Promotions ---------------------------------------------------------------

    private function promo(array $over = []): \App\Models\PromoCode
    {
        return \App\Models\PromoCode::create(array_merge(['code' => 'WELCOME10', 'type' => 'percent', 'value' => 10, 'min_amount' => 0, 'is_active' => true], $over));
    }

    public function test_percent_and_fixed_discounts_are_computed_on_the_server_in_whole_won(): void
    {
        $this->promo(['code' => 'PCT', 'type' => 'percent', 'value' => 15, 'max_discount' => 3000]);
        $this->promo(['code' => 'FIXED', 'type' => 'fixed', 'value' => 50000]);

        $r = $this->book($this->customer(), ['A1', 'B1'], null, ['promo_code' => 'pct'])->assertCreated(); // 28000 * 15% = 4200, capped at 3000
        $this->assertSame([28000, 3000, 25000], [$r->json('data.subtotal'), $r->json('data.discount'), $r->json('data.total')]);

        $r = $this->book($this->customer(), ['A3'], null, ['promo_code' => 'FIXED'])->assertCreated(); // never below zero
        $this->assertSame([12000, 12000, 0], [$r->json('data.subtotal'), $r->json('data.discount'), $r->json('data.total')]);

        $this->promo(['code' => 'ODD', 'type' => 'percent', 'value' => 7]);
        $r = $this->book($this->customer(), ['A4'], null, ['promo_code' => 'ODD'])->assertCreated(); // 840 exactly: whole won
        $this->assertSame(840, $r->json('data.discount'));
    }

    public function test_invalid_promo_codes_are_rejected_without_creating_a_booking(): void
    {
        $this->promo(['code' => 'OFF', 'is_active' => false]);
        $this->promo(['code' => 'OLD', 'ends_at' => now()->subDay()]);
        $this->promo(['code' => 'FUTURE', 'starts_at' => now()->addDay()]);
        $this->promo(['code' => 'BIG', 'min_amount' => 100000]);
        $this->promo(['code' => 'USEDUP', 'usage_limit' => 1])->forceFill(['used_count' => 1])->save();
        $otherMovie = $this->movie();
        $this->promo(['code' => 'OTHERMOVIE'])->movies()->attach($otherMovie);

        $user = $this->customer();
        foreach (['NOPE', 'OFF', 'OLD', 'FUTURE', 'BIG', 'USEDUP', 'OTHERMOVIE'] as $code) {
            $this->book($user, ['A1'], null, ['promo_code' => $code])->assertStatus(422)->assertJsonValidationErrors('promo_code');
        }
        $this->assertSame(0, Booking::count());
        $this->assertSame(0, ShowtimeSeat::where('status', 'held')->count());
    }

    public function test_per_user_limit_and_usage_are_tracked_and_given_back_on_cancel(): void
    {
        // Two unpaid bookings must be allowed, so the second request reaches the promo rule under test.
        config(['cineora.booking.max_active_unpaid_bookings' => 2]);
        $promo = $this->promo(['code' => 'ONCE', 'per_user_limit' => 1, 'usage_limit' => 5]);
        $user = $this->customer();

        $id = $this->book($user, ['A1'], null, ['promo_code' => 'ONCE'])->assertCreated()->json('data.id');
        $this->assertSame(1, $promo->fresh()->used_count);
        $this->book($user, ['A2'], null, ['promo_code' => 'ONCE'])->assertStatus(422);

        $this->postJson("/api/v1/bookings/{$id}/cancel")->assertOk();
        $this->assertSame(0, $promo->fresh()->used_count);
        $this->book($user, ['A2'], null, ['promo_code' => 'ONCE'])->assertCreated();
    }
}
