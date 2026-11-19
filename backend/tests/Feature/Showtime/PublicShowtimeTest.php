<?php

namespace Tests\Feature\Showtime;

use App\Enums\MovieStatus;
use App\Models\Showtime;
use Illuminate\Support\Carbon;

class PublicShowtimeTest extends ShowtimeTestCase
{
    private function onSale(array $over = []): Showtime
    {
        $this->as($this->admin());
        $id = $this->createShowtime($over);
        $this->postJson("/api/v1/admin/showtimes/{$id}/publish")->assertOk();
        $this->flushHeaders();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();

        return Showtime::where('public_id', $id)->firstOrFail();
    }

    public function test_only_on_sale_future_showtimes_of_published_movies_are_listed(): void
    {
        $live = $this->onSale(['starts_at' => $this->at(2, '12:00')]);
        // draft, cancelled, past, unpublished-movie and inactive-cinema showtimes stay hidden
        Showtime::factory()->create(['cinema_id' => $this->cinema->id, 'room_id' => $this->room->id, 'movie_id' => $this->movie->id, 'starts_at' => now()->addDays(2)->setTime(15, 0), 'ends_at' => now()->addDays(2)->setTime(17, 0), 'status' => 'draft']);
        Showtime::factory()->create(['cinema_id' => $this->cinema->id, 'room_id' => $this->room->id, 'movie_id' => $this->movie->id, 'starts_at' => now()->addDays(2)->setTime(18, 0), 'ends_at' => now()->addDays(2)->setTime(20, 0), 'status' => 'cancelled']);
        Showtime::factory()->create(['cinema_id' => $this->cinema->id, 'room_id' => $this->room->id, 'movie_id' => $this->movie->id, 'starts_at' => now()->subHour(), 'ends_at' => now()->addHour(), 'status' => 'on_sale']);
        $hiddenMovie = $this->movie(['status' => MovieStatus::Draft]);
        Showtime::factory()->create(['cinema_id' => $this->cinema->id, 'room_id' => $this->room->id, 'movie_id' => $hiddenMovie->id, 'starts_at' => now()->addDays(2)->setTime(21, 0), 'ends_at' => now()->addDays(2)->setTime(23, 0), 'status' => 'on_sale']);

        $r = $this->getJson('/api/v1/showtimes')->assertOk();

        $this->assertSame([$live->public_id], array_column($r->json('data'), 'id'));
        $row = $r->json('data.0');
        $this->assertSame($this->movie->slug, $row['movie']['slug']);
        $this->assertSame(6, $row['available_seats']);
        $this->assertSame(12000, $row['from_price']);
        $this->assertTrue($row['bookable']);
        $this->assertArrayNotHasKey('status', $row);
        $this->assertArrayNotHasKey('created_at', $row);
        $this->assertStringEndsWith('+00:00', $row['starts_at']);
    }

    public function test_filters_by_movie_cinema_and_local_calendar_day(): void
    {
        $a = $this->onSale(['starts_at' => $this->at(2, '09:30')]);
        // 00:30 Seoul time on the next day is still the previous day in UTC: the date filter must use Seoul's calendar.
        $late = $this->onSale(['starts_at' => $this->at(3, '00:30')]);
        $otherMovie = $this->movie(['duration_min' => 90]);
        $b = $this->onSale(['movie' => $otherMovie->public_id, 'starts_at' => $this->at(2, '14:00')]);

        $ids = fn (string $qs) => collect($this->getJson('/api/v1/showtimes?'.$qs)->assertOk()->json('data'))->pluck('id')->all();
        $day2 = Carbon::now('Asia/Seoul')->addDays(2)->format('Y-m-d');
        $day3 = Carbon::now('Asia/Seoul')->addDays(3)->format('Y-m-d');

        $this->assertEqualsCanonicalizing([$a->public_id, $b->public_id], $ids("date=$day2&cinema={$this->cinema->slug}"));
        $this->assertSame([$late->public_id], $ids("date=$day3&cinema={$this->cinema->slug}"));
        $this->assertSame([$b->public_id], $ids("movie={$otherMovie->slug}"));
        $this->assertSame([], $ids('cinema=no-such-cinema'));
        $this->getJson('/api/v1/showtimes?date=31-12-2030')->assertStatus(422);
        $this->getJson('/api/v1/showtimes?per_page=9999')->assertStatus(422);
    }

    public function test_inactive_cinemas_are_hidden(): void
    {
        $st = $this->onSale();
        $this->cinema->update(['is_active' => false]);

        $this->assertSame([], $this->getJson('/api/v1/showtimes')->json('data'));
        $this->getJson("/api/v1/showtimes/{$st->public_id}")->assertNotFound();
    }

    public function test_seat_map_states_come_from_the_database_and_expired_holds_are_free(): void
    {
        $st = $this->onSale();
        $seats = $st->seats()->with('seat')->get()->keyBy(fn ($s) => $s->seat->row_label.$s->seat->number);
        $seats['A1']->update(['status' => 'sold']);
        $seats['A2']->update(['status' => 'held', 'hold_expires_at' => now()->addMinutes(10)]);
        $seats['A3']->update(['status' => 'held', 'hold_expires_at' => now()->subMinute()]); // lapsed hold
        $seats['B1']->update(['status' => 'blocked']);
        $seats['B2']->seat->update(['is_active' => false]);

        $r = $this->getJson("/api/v1/showtimes/{$st->public_id}/seats")->assertOk();
        $map = collect($r->json('data.seats'))->keyBy('key');

        $this->assertSame('sold', $map['A1']['status']);
        $this->assertSame('held', $map['A2']['status']);
        $this->assertSame('available', $map['A3']['status']);
        $this->assertSame('available', $map['A4']['status']);
        $this->assertSame('unavailable', $map['B1']['status']);
        $this->assertSame('unavailable', $map['B2']['status']);
        $this->assertSame(['standard', 12000], [$map['A1']['category_key'], $map['A1']['price']]);
        $this->assertSame(16000, $map['B1']['price']);
        $this->assertTrue($r->json('data.bookable'));

        // Who holds a seat or which booking owns it is never disclosed.
        $this->assertSame(['key', 'row_label', 'number', 'category_key', 'category_name', 'price', 'status', 'x', 'y'], array_keys($map['A2']));

        $listed = $this->getJson('/api/v1/showtimes')->json('data.0.available_seats');
        $this->assertSame(2, $listed, 'A3 (lapsed hold) and A4 are free; sold, live hold, blocked and inactive seats are not');
        $this->assertSame(2, $this->getJson("/api/v1/showtimes/{$st->public_id}")->json('data.available_seats'));
    }

    public function test_availability_is_never_cacheable(): void
    {
        $st = $this->onSale();
        $r = $this->getJson("/api/v1/showtimes/{$st->public_id}/seats");
        $this->assertStringContainsString('no-store', $r->headers->get('Cache-Control'));
    }

    public function test_a_showtime_inside_its_sales_cutoff_is_visible_but_not_bookable(): void
    {
        $st = $this->onSale();
        $st->forceFill(['starts_at' => now()->addMinutes(10), 'sales_cutoff_minutes' => 15])->save();

        $this->assertFalse($this->getJson("/api/v1/showtimes/{$st->public_id}")->json('data.bookable'));
        $this->assertFalse($this->getJson("/api/v1/showtimes/{$st->public_id}/seats")->json('data.bookable'));
    }

    public function test_draft_cancelled_started_and_unknown_showtimes_are_404(): void
    {
        $this->as($this->admin());
        $draft = $this->createShowtime();
        $this->flushHeaders();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);

        $this->getJson("/api/v1/showtimes/{$draft}")->assertNotFound();
        $this->getJson("/api/v1/showtimes/{$draft}/seats")->assertNotFound();

        $st = Showtime::where('public_id', $draft)->first();
        $st->forceFill(['status' => 'on_sale', 'starts_at' => now()->subMinute()])->save();
        $this->getJson("/api/v1/showtimes/{$draft}")->assertNotFound();
        $this->getJson('/api/v1/showtimes/'.str_repeat('0', 26))->assertNotFound();
        $this->getJson("/api/v1/showtimes/{$st->id}")->assertNotFound();
    }
}
