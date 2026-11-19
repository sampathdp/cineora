<?php

namespace Tests\Feature\Booking;

use App\Enums\BookingStatus;
use App\Exceptions\DomainConflictException;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\PromoCode;
use App\Models\SeatHold;
use App\Models\ShowtimeSeat;
use App\Services\Booking\BookingExpiryService;
use App\Services\Booking\BookingStateMachine;
use Illuminate\Support\Carbon;

class BookingLifecycleTest extends BookingTestCase
{
    private function make($user, array $seats = ['A1'], array $extra = []): Booking
    {
        return Booking::where('public_id', $this->book($user, $seats, null, $extra)->assertCreated()->json('data.id'))->firstOrFail();
    }

    // --- Ownership / IDOR ----------------------------------------------------------

    public function test_customers_only_ever_see_and_touch_their_own_bookings(): void
    {
        $alice = $this->customer();
        $mallory = $this->customer();
        $mine = $this->make($alice);
        $this->make($mallory, ['A2']);

        $this->as($mallory)->getJson("/api/v1/bookings/{$mine->public_id}")->assertNotFound();
        $this->postJson("/api/v1/bookings/{$mine->public_id}/cancel")->assertNotFound();
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $mine->fresh()->status);
        $this->getJson("/api/v1/bookings/{$mine->id}")->assertNotFound(); // numeric ids are not an alternative key

        $list = $this->getJson('/api/v1/bookings')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertNotSame($mine->public_id, $list[0]['id']);

        $this->as($alice)->getJson("/api/v1/bookings/{$mine->public_id}")->assertOk()->assertJsonPath('data.reference', $mine->reference);
    }

    public function test_staff_roles_do_not_gain_access_to_customer_booking_endpoints(): void
    {
        $mine = $this->make($this->customer());
        $this->as($this->staff(\App\Enums\Role::SuperAdmin))->getJson("/api/v1/bookings/{$mine->public_id}")->assertNotFound();
    }

    public function test_bookings_endpoints_require_login(): void
    {
        $mine = $this->make($this->customer());
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/bookings')->assertUnauthorized();
        $this->getJson("/api/v1/bookings/{$mine->public_id}")->assertUnauthorized();
        $this->postJson("/api/v1/bookings/{$mine->public_id}/cancel")->assertUnauthorized();
    }

    // --- Cancel --------------------------------------------------------------------

    public function test_owner_can_cancel_an_unpaid_booking_and_seats_return_to_sale(): void
    {
        $user = $this->customer();
        $b = $this->make($user, ['A1', 'A2']);

        $this->postJson("/api/v1/bookings/{$b->public_id}/cancel")->assertOk()->assertJsonPath('data.status', 'CANCELLED');

        $this->assertSame(BookingStatus::CANCELLED, $b->fresh()->status);
        $this->assertNotNull($b->fresh()->cancelled_at);
        $this->assertSame(0, ShowtimeSeat::where('status', 'held')->count());
        $this->assertSame(0, BookingSeat::whereNull('released_at')->count());
        $this->assertSame(0, SeatHold::whereNull('released_at')->count());
        $this->assertSame(['PENDING_PAYMENT', 'CANCELLED'], $b->histories()->orderBy('id')->pluck('to_status')->all());
        $this->assertSame(1, AuditLog::where('action', 'booking.status_changed')->count());

        // Seats are immediately bookable by someone else.
        $this->book($this->customer(), ['A1', 'A2'])->assertCreated();
        // Cancelling twice is refused, not repeated.
        $this->as($user)->postJson("/api/v1/bookings/{$b->public_id}/cancel")->assertStatus(409)->assertJson(['code' => 'not_cancellable']);
    }

    public function test_paid_or_in_review_bookings_cannot_be_cancelled_through_the_customer_endpoint(): void
    {
        $user = $this->customer();
        foreach ([BookingStatus::PAYMENT_REVIEW, BookingStatus::CONFIRMED, BookingStatus::PAYMENT_EXCEPTION, BookingStatus::EXPIRED] as $i => $status) {
            $b = $this->make($user, ['A'.($i + 1)]);
            $b->forceFill(['status' => $status])->save();
            $this->postJson("/api/v1/bookings/{$b->public_id}/cancel")->assertStatus(409);
            $this->assertSame($status, $b->fresh()->status);
        }
    }

    // --- State machine -------------------------------------------------------------

    public function test_state_machine_rejects_arbitrary_transitions_and_records_valid_ones(): void
    {
        $b = $this->make($this->customer());
        $machine = app(BookingStateMachine::class);

        foreach ([BookingStatus::CONFIRMED, BookingStatus::REFUNDED, BookingStatus::PAYMENT_REJECTED, BookingStatus::PENDING_PAYMENT] as $illegal) {
            try {
                $machine->transition($b, $illegal, null);
                $this->fail("PENDING_PAYMENT -> {$illegal->value} must be refused");
            } catch (DomainConflictException $e) {
                $this->assertSame('invalid_transition', $e->errorCode);
            }
        }
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $b->fresh()->status);
        $this->assertSame(1, $b->histories()->count(), 'refused transitions leave no history');

        $machine->transition($b, BookingStatus::PAYMENT_REVIEW, null, 'proof submitted');
        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $b->fresh()->status);
        $this->assertSame('proof submitted', $b->histories()->latest('id')->first()->reason);
    }

    public function test_state_machine_judges_the_database_state_not_a_stale_model(): void
    {
        $b = $this->make($this->customer());
        $stale = Booking::find($b->id); // loaded while PENDING_PAYMENT
        app(BookingStateMachine::class)->transition($b, BookingStatus::CANCELLED, null); // changes it behind $stale's back

        $this->expectException(DomainConflictException::class);
        app(BookingStateMachine::class)->transition($stale, BookingStatus::PAYMENT_REVIEW, null);
    }

    public function test_state_machine_rolls_everything_back_if_a_side_effect_fails(): void
    {
        $b = $this->make($this->customer());

        try {
            app(BookingStateMachine::class)->transition($b, BookingStatus::CANCELLED, null, null, fn () => throw new \RuntimeException('boom'));
        } catch (\RuntimeException) {
        }

        $this->assertSame(BookingStatus::PENDING_PAYMENT, $b->fresh()->status);
        $this->assertSame(1, $b->histories()->count());
    }

    // --- Expiry --------------------------------------------------------------------

    public function test_due_unpaid_bookings_expire_release_seats_and_promo_usage(): void
    {
        $promo = PromoCode::create(['code' => 'EXP', 'type' => 'fixed', 'value' => 1000, 'min_amount' => 0, 'is_active' => true]);
        $b = $this->make($this->customer(), ['A1', 'B1'], ['promo_code' => 'EXP']);
        $this->assertSame(1, $promo->fresh()->used_count);

        Carbon::setTestNow(now()->addMinutes(16));
        $this->assertSame(1, app(BookingExpiryService::class)->expireDue());

        $this->assertSame(BookingStatus::EXPIRED, $b->fresh()->status);
        $this->assertSame(0, ShowtimeSeat::where('status', 'held')->count());
        $this->assertSame(0, BookingSeat::whereNull('released_at')->count());
        $this->assertSame(0, $promo->fresh()->used_count);
        $this->assertSame('hold expired', $b->histories()->latest('id')->first()->reason);
        Carbon::setTestNow();
    }

    public function test_expiry_is_idempotent_and_leaves_undue_bookings_alone(): void
    {
        $fresh = $this->make($this->customer(), ['A1']);
        $old = $this->make($this->customer(), ['A2']);
        $service = app(BookingExpiryService::class);

        $this->assertSame(0, $service->expireDue());
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $fresh->fresh()->status);

        $old->forceFill(['hold_expires_at' => now()->subMinute()])->save();
        $this->assertSame(1, $service->expireDue());
        $this->assertSame(0, $service->expireDue(), 'second run finds nothing');
        $this->assertFalse($service->expireOne($old->id), 'direct repeat is a no-op');
        $this->assertSame(2, $old->histories()->count());
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $fresh->fresh()->status);
    }

    public function test_expiry_never_touches_bookings_that_are_paid_in_review_or_in_exception(): void
    {
        $user = $this->customer();
        $seatsKept = [];
        foreach ([BookingStatus::PAYMENT_REVIEW, BookingStatus::CONFIRMED, BookingStatus::PAYMENT_EXCEPTION, BookingStatus::REFUND_PENDING] as $i => $status) {
            $b = $this->make($user, ['A'.($i + 1)]);
            $b->forceFill(['status' => $status, 'hold_expires_at' => now()->subHour(), 'payment_deadline_at' => now()->subMinutes(30)])->save();
            $seatsKept[] = $b;
        }

        $this->assertSame(0, app(BookingExpiryService::class)->expireDue());
        foreach ($seatsKept as $b) {
            $this->assertNotSame(BookingStatus::EXPIRED, $b->fresh()->status);
        }
        $this->assertSame(4, ShowtimeSeat::where('status', 'held')->count(), 'their seats stay allocated');
    }

    public function test_rejected_payments_expire_after_the_payment_deadline_not_before(): void
    {
        $b = $this->make($this->customer(), ['A1']);
        $b->forceFill(['status' => BookingStatus::PAYMENT_REJECTED, 'hold_expires_at' => now()->subMinute()])->save();

        $this->assertSame(0, app(BookingExpiryService::class)->expireDue(), 'the original hold lapsing is not enough while a re-submission is possible');
        $b->forceFill(['payment_deadline_at' => now()->subSecond()])->save();
        $this->assertSame(1, app(BookingExpiryService::class)->expireDue());
        $this->assertSame(0, ShowtimeSeat::where('status', 'held')->count());
    }

    public function test_maintenance_command_and_schedule_are_wired(): void
    {
        $b = $this->make($this->customer(), ['A1']);
        $b->forceFill(['hold_expires_at' => now()->subMinute()])->save();
        $this->showtime->forceFill(['starts_at' => now()->subHours(4), 'ends_at' => now()->subHours(2)])->save();

        $this->artisan('bookings:maintain')->assertSuccessful();

        $this->assertSame(BookingStatus::EXPIRED, $b->fresh()->status);
        $this->assertSame('completed', $this->showtime->fresh()->status->value);
        $this->artisan('schedule:list')->expectsOutputToContain('booking-maintenance')->assertSuccessful();
    }

    public function test_idempotency_keys_are_pruned_after_two_days(): void
    {
        $this->make($this->customer());
        \DB::table('idempotency_keys')->update(['created_at' => now()->subDays(3)]);
        $this->assertSame(1, app(BookingExpiryService::class)->pruneIdempotencyKeys());
    }
}
