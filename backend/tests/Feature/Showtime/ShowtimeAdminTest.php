<?php

namespace Tests\Feature\Showtime;

use App\Enums\BookingStatus;
use App\Enums\MovieStatus;
use App\Enums\Role;
use App\Enums\ShowtimeStatus;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\Showtime;
use App\Models\ShowtimeSeat;

class ShowtimeAdminTest extends ShowtimeTestCase
{
    public function test_create_builds_draft_prices_and_seat_inventory_with_buffered_end_time(): void
    {
        $r = $this->as($this->admin())->postJson('/api/v1/admin/showtimes', $this->payload())->assertCreated();

        $st = Showtime::where('public_id', $r->json('data.id'))->firstOrFail();
        $this->assertSame(ShowtimeStatus::Draft, $st->status);
        $this->assertSame($this->cinema->id, $st->cinema_id);
        // 100 min film + configured 20 min turnaround
        $this->assertSame(120, (int) $st->starts_at->diffInMinutes($st->ends_at));
        $this->assertSame(6, $st->seats()->count());
        $this->assertSame([12000, 16000], $st->prices()->orderBy('price')->pluck('price')->map(fn ($p) => (int) $p)->all());
        $this->assertSame(4, $st->seats()->where('price', 12000)->count());
        $this->assertSame(2, $st->seats()->where('price', 16000)->count());
        $this->assertSame(['standard', 'premium'], collect($r->json('data.prices'))->pluck('category_key')->sortDesc()->values()->all());
        $this->assertSame(1, AuditLog::where('action', 'showtime.created')->count());
        $this->assertSame('KRW', $r->json('data.currency'));
    }

    public function test_input_validation(): void
    {
        $this->as($this->admin());
        $bad = [
            'past start' => ['starts_at' => now('Asia/Seoul')->subHour()->toIso8601String()],
            'too far ahead' => ['starts_at' => $this->at(400)],
            'no offset' => ['starts_at' => '2030-01-01T19:00'],
            'garbage date' => ['starts_at' => 'tomorrow'],
            'unknown movie' => ['movie' => str_repeat('0', 26)],
            'unknown room' => ['room' => str_repeat('0', 26)],
            'missing category' => ['prices' => [['category_key' => 'standard', 'price' => 12000]]],
            'extra category' => ['prices' => [...$this->prices(), ['category_key' => 'lounge', 'price' => 20000]]],
            'duplicate category' => ['prices' => [...$this->prices(), ['category_key' => 'standard', 'price' => 9000]]],
            'fractional price' => ['prices' => $this->prices(12000.5)],
            'negative price' => ['prices' => $this->prices(-1)],
            'huge price' => ['prices' => $this->prices(99999999)],
            'string price' => ['prices' => $this->prices('abc')],
            'cutoff too large' => ['sales_cutoff_minutes' => 5000],
        ];
        foreach ($bad as $label => $over) {
            $this->postJson('/api/v1/admin/showtimes', $this->payload($over))->assertStatus(422);
            $this->assertSame(0, Showtime::count(), "$label must not create anything");
        }
    }

    public function test_client_cannot_inject_status_cinema_or_end_time(): void
    {
        $this->as($this->admin());
        $other = \App\Models\Cinema::factory()->create();
        $id = $this->createShowtime(['status' => 'on_sale', 'cinema_id' => $other->id, 'ends_at' => $this->at(3, '19:01'), 'cinema' => $other->public_id]);

        $st = Showtime::where('public_id', $id)->firstOrFail();
        $this->assertSame(ShowtimeStatus::Draft, $st->status);
        $this->assertSame($this->cinema->id, $st->cinema_id);
        $this->assertSame(120, (int) $st->starts_at->diffInMinutes($st->ends_at));
    }

    public function test_archived_movie_inactive_room_and_empty_room_are_rejected(): void
    {
        $this->as($this->admin());
        $archived = $this->movie(['status' => MovieStatus::Archived]);
        $this->postJson('/api/v1/admin/showtimes', $this->payload(['movie' => $archived->public_id]))->assertStatus(422)->assertJsonValidationErrors('movie_id');

        $inactive = $this->roomWithSeats($this->cinema);
        $inactive->update(['is_active' => false]);
        $this->postJson('/api/v1/admin/showtimes', $this->payload(['room' => $inactive->public_id]))->assertStatus(422)->assertJsonValidationErrors('room_id');

        $empty = \App\Models\ScreeningRoom::factory()->create(['cinema_id' => $this->cinema->id]);
        $this->postJson('/api/v1/admin/showtimes', $this->payload(['room' => $empty->public_id]))->assertStatus(422);
    }

    public function test_overlap_rules_including_the_turnaround_buffer(): void
    {
        $this->as($this->admin());
        $this->createShowtime(['starts_at' => $this->at(3, '19:00')]); // occupies 19:00 to 21:00 (100 + 20)

        $clash = fn (string $time, ?array $over = []) => $this->postJson('/api/v1/admin/showtimes', $this->payload(['starts_at' => $this->at(3, $time)] + $over));

        $clash('19:00')->assertStatus(422)->assertJsonValidationErrors('starts_at');   // identical slot
        $clash('18:00')->assertStatus(422);                                            // film would run into the next one
        $clash('20:59')->assertStatus(422);                                            // inside the buffer
        $clash('17:00')->assertCreated();                                              // ends 19:00 incl. buffer: back to back is allowed
        $clash('21:00')->assertCreated();                                              // starts exactly when the buffer ends

        // Another room at the same time is fine.
        $other = $this->roomWithSeats($this->cinema, 'Hall B');
        $clash('19:00', ['room' => $other->public_id])->assertCreated();
        $this->assertSame(4, Showtime::count());
    }

    public function test_cancelled_showtimes_do_not_block_their_slot(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime(['starts_at' => $this->at(3, '19:00')]);
        $this->postJson("/api/v1/admin/showtimes/{$id}/cancel")->assertOk();

        $this->postJson('/api/v1/admin/showtimes', $this->payload(['starts_at' => $this->at(3, '19:00')]))->assertCreated();
    }

    public function test_cinema_manager_is_limited_to_assigned_cinemas_and_roles_are_enforced(): void
    {
        $manager = $this->staff(Role::CinemaManager);
        $manager->cinemas()->attach($this->cinema);
        $manager->flushAccessCache();

        $otherCinema = \App\Models\Cinema::factory()->create();
        $otherRoom = $this->roomWithSeats($otherCinema);

        $this->as($manager);
        $id = $this->createShowtime();
        $this->postJson('/api/v1/admin/showtimes', $this->payload(['room' => $otherRoom->public_id]))->assertForbidden();

        $foreign = Showtime::factory()->create(['cinema_id' => $otherCinema->id, 'room_id' => $otherRoom->id]);
        $this->getJson("/api/v1/admin/showtimes/{$foreign->public_id}")->assertForbidden();
        $this->patchJson("/api/v1/admin/showtimes/{$foreign->public_id}", ['sales_cutoff_minutes' => 5])->assertForbidden();
        $this->putJson("/api/v1/admin/showtimes/{$foreign->public_id}/prices", ['prices' => $this->prices()])->assertForbidden();
        $this->postJson("/api/v1/admin/showtimes/{$foreign->public_id}/publish")->assertForbidden();
        $this->postJson("/api/v1/admin/showtimes/{$foreign->public_id}/cancel")->assertForbidden();
        $this->getJson("/api/v1/admin/showtimes/{$foreign->public_id}/seats")->assertForbidden();
        // Moving a showtime into a cinema the manager does not run is forbidden too.
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['room' => $otherRoom->public_id])->assertForbidden();

        $list = $this->getJson('/api/v1/admin/showtimes')->assertOk()->json('data');
        $this->assertSame([$id], array_column($list, 'id'));

        foreach ([$this->customer(), $this->staff(Role::TicketChecker), $this->staff(Role::PaymentVerifier), $this->staff(Role::ContentManager)] as $user) {
            $this->as($user)->getJson('/api/v1/admin/showtimes')->assertForbidden();
            $this->postJson('/api/v1/admin/showtimes', $this->payload())->assertForbidden();
        }
        $this->flushHeaders();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/showtimes')->assertUnauthorized();
    }

    public function test_publish_requires_a_published_movie_and_can_happen_once(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();

        $this->movie->forceFill(['status' => MovieStatus::Draft])->save();
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertStatus(422)->assertJsonValidationErrors('movie');

        $this->movie->forceFill(['status' => MovieStatus::Published])->save();
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertOk()->assertJsonPath('data.status', 'on_sale');
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertStatus(409)->assertJson(['code' => 'invalid_state']);
    }

    public function test_reschedule_is_validated_and_rebuilds_nothing_unnecessarily(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime(['starts_at' => $this->at(3, '19:00')]);
        $other = $this->createShowtime(['starts_at' => $this->at(3, '22:00')]);
        $st = Showtime::where('public_id', $id)->first();
        $inventoryIds = $st->seats()->pluck('id')->all();

        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['starts_at' => $this->at(3, '21:30')])->assertStatus(422); // runs into the 22:00 show
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['starts_at' => $this->at(4, '15:00')])->assertOk();
        $this->assertSame($inventoryIds, $st->fresh()->seats()->pluck('id')->all());
        $this->assertSame(120, (int) $st->fresh()->starts_at->diffInMinutes($st->fresh()->ends_at));

        // Rescheduling onto itself must not clash with itself.
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['starts_at' => $this->at(4, '15:00')])->assertOk();
        // A longer movie changes the end time and is re-checked for overlap.
        $long = $this->movie(['duration_min' => 300]);
        $this->patchJson("/api/v1/admin/showtimes/{$other}", ['movie' => $long->public_id])->assertOk();
        $row = Showtime::where('public_id', $other)->first();
        $this->assertSame(320, (int) $row->starts_at->diffInMinutes($row->ends_at));
    }

    public function test_moving_to_another_room_rebuilds_inventory_and_requires_matching_prices(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();
        $bigRoom = $this->roomWithSeats($this->cinema, 'Big');
        \App\Models\Seat::factory()->create(['room_id' => $bigRoom->id, 'seat_category_id' => \App\Models\SeatCategory::where('key', 'lounge')->value('id'), 'row_label' => 'C', 'number' => 1]);

        // The new room has a lounge seat, so old prices alone are not enough.
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['room' => $bigRoom->public_id])->assertStatus(422)->assertJsonValidationErrors('prices');

        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['room' => $bigRoom->public_id, 'prices' => [...$this->prices(), ['category_key' => 'lounge', 'price' => 22000]]])->assertOk();
        $st = Showtime::where('public_id', $id)->first();
        $this->assertSame($bigRoom->id, $st->room_id);
        $this->assertSame(7, $st->seats()->count());
        $this->assertSame(3, $st->prices()->count());
    }

    public function test_live_bookings_freeze_schedule_room_movie_and_prices_but_not_the_cutoff(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();
        $st = Showtime::where('public_id', $id)->first();
        $booking = Booking::factory()->create(['showtime_id' => $st->id, 'status' => BookingStatus::PAYMENT_REVIEW->value]);

        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['starts_at' => $this->at(5)])->assertStatus(409)->assertJson(['code' => 'has_active_bookings']);
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['movie' => $this->movie(['duration_min' => 90])->public_id])->assertStatus(409);
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['room' => $this->roomWithSeats($this->cinema, 'Other')->public_id, 'prices' => $this->prices()])->assertStatus(409);
        $this->putJson("/api/v1/admin/showtimes/{$id}/prices", ['prices' => $this->prices(1000, 2000)])->assertStatus(409)->assertJson(['code' => 'has_active_bookings']);
        $this->postJson("/api/v1/admin/showtimes/{$id}/cancel")->assertStatus(409);
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['sales_cutoff_minutes' => 30])->assertOk();

        $this->assertSame(12000, (int) $st->prices()->whereHas('category', fn ($q) => $q->where('key', 'standard'))->value('price'));

        // Once the booking is no longer live, the showtime can be changed again.
        $booking->forceFill(['status' => BookingStatus::EXPIRED->value])->save();
        $this->putJson("/api/v1/admin/showtimes/{$id}/prices", ['prices' => $this->prices(1000, 2000)])->assertOk();
    }

    public function test_price_change_updates_inventory_snapshots_and_is_audited(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();
        $st = Showtime::where('public_id', $id)->first();

        $this->putJson("/api/v1/admin/showtimes/{$id}/prices", ['prices' => $this->prices(10000, 18000)])->assertOk();

        $this->assertSame(4, $st->seats()->where('price', 10000)->count());
        $this->assertSame(2, $st->seats()->where('price', 18000)->count());
        $log = AuditLog::where('action', 'showtime.prices_changed')->firstOrFail();
        $this->assertEquals(['standard' => 12000, 'premium' => 16000], $log->metadata['before']);
        $this->assertEquals(['standard' => 10000, 'premium' => 18000], $log->metadata['after']);

        $this->putJson("/api/v1/admin/showtimes/{$id}/prices", ['prices' => [['category_key' => 'standard', 'price' => 1]]])->assertStatus(422);
        $this->assertSame(4, $st->seats()->where('price', 10000)->count(), 'a rejected change must leave prices untouched');
    }

    public function test_price_permission_is_separate_from_schedule_permission(): void
    {
        $role = \App\Models\AccessRole::create(['key' => 'scheduler', 'name' => 'Scheduler']);
        $role->permissions()->sync(\App\Models\AccessPermission::whereIn('key', ['showtimes.manage'])->pluck('id'));
        $user = \App\Models\User::factory()->create();
        $user->roles()->attach($role->id);
        $user->cinemas()->attach($this->cinema);
        $user->flushAccessCache();

        $id = $this->as($user)->createShowtime();
        $this->putJson("/api/v1/admin/showtimes/{$id}/prices", ['prices' => $this->prices(1, 1)])->assertForbidden();
    }

    public function test_cancel_blocks_inventory_and_started_or_cancelled_showtimes_are_immutable(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();
        $st = Showtime::where('public_id', $id)->first();

        $this->postJson("/api/v1/admin/showtimes/{$id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(6, $st->seats()->where('status', 'blocked')->count());
        $this->postJson("/api/v1/admin/showtimes/{$id}/cancel")->assertStatus(409);
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertStatus(409);
        $this->patchJson("/api/v1/admin/showtimes/{$id}", ['sales_cutoff_minutes' => 5])->assertStatus(409);

        $started = Showtime::factory()->create(['cinema_id' => $this->cinema->id, 'room_id' => $this->room->id, 'starts_at' => now()->subMinutes(10), 'ends_at' => now()->addMinutes(100), 'status' => 'on_sale']);
        $this->putJson("/api/v1/admin/showtimes/{$started->public_id}/prices", ['prices' => $this->prices()])->assertStatus(409)->assertJson(['code' => 'already_started']);
    }

    public function test_admin_detail_reports_seat_counts_and_never_trusts_numeric_ids(): void
    {
        $this->as($this->admin());
        $id = $this->createShowtime();
        $st = Showtime::where('public_id', $id)->first();
        $st->seats()->limit(1)->update(['status' => 'sold']);

        $r = $this->getJson("/api/v1/admin/showtimes/{$id}")->assertOk();
        $this->assertSame(['total' => 6, 'available' => 5, 'held' => 0, 'sold' => 1, 'unavailable' => 0], $r->json('data.seat_counts'));
        $this->getJson("/api/v1/admin/showtimes/{$st->id}")->assertNotFound();
        $this->assertSame(0, BookingSeat::count() + ShowtimeSeat::where('status', 'held')->count());
    }
}
