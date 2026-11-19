<?php

namespace Tests\Feature\Database;

use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\Cinema;
use App\Models\Payment;
use App\Models\Seat;
use App\Models\SeatCategory;
use App\Models\ScreeningRoom;
use App\Models\Showtime;
use App\Models\ShowtimeSeat;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** Runs against real MySQL: these constraints are the last line of defence against double booking. */
class SchemaConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_expected_tables_exist_and_are_innodb(): void
    {
        $expected = [
            'users', 'customer_profiles', 'roles', 'permissions', 'role_permissions', 'user_roles', 'staff_cinema_assignments',
            'password_reset_tokens', 'sessions', 'cinemas', 'screening_rooms', 'seats', 'seat_categories', 'cinema_facilities', 'cinema_images',
            'movies', 'genres', 'movie_genres', 'movie_cast', 'movie_crew', 'movie_images', 'movie_trailers', 'movie_languages',
            'showtimes', 'showtime_seat_prices', 'showtime_seats', 'bookings', 'booking_seats', 'seat_holds', 'booking_events',
            'booking_status_histories', 'idempotency_keys', 'bank_accounts', 'payments', 'payment_proofs', 'payment_reviews',
            'refund_requests', 'refund_transactions', 'tickets', 'ticket_checkins', 'ticket_validation_events', 'promo_codes',
            'promo_redemptions', 'events', 'articles', 'article_categories', 'testimonials', 'site_settings', 'site_content',
            'social_links', 'contact_messages', 'newsletter_subscribers', 'audit_logs', 'notifications', 'notification_attempts', 'outbox_messages',
        ];
        foreach ($expected as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table {$table}");
        }
        $nonInnoDb = DB::select("select table_name as t from information_schema.tables where table_schema = database() and engine <> 'InnoDB'");
        $this->assertSame([], $nonInnoDb);
    }

    public function test_money_columns_are_decimal_not_float(): void
    {
        $bad = DB::select("select table_name t, column_name c, data_type d from information_schema.columns where table_schema = database() and data_type in ('float','double') ");
        $this->assertSame([], $bad);
    }

    public function test_duplicate_seat_number_in_a_room_is_rejected(): void
    {
        $room = ScreeningRoom::factory()->create();
        $cat = SeatCategory::factory()->create();
        Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 1]);

        $this->expectException(QueryException::class);
        Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 1]);
    }

    public function test_same_seat_label_in_another_room_is_allowed(): void
    {
        $cat = SeatCategory::factory()->create();
        Seat::factory()->create(['room_id' => ScreeningRoom::factory(), 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 1]);
        Seat::factory()->create(['room_id' => ScreeningRoom::factory(), 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 1]);
        $this->assertSame(2, Seat::count());
    }

    public function test_showtime_room_must_belong_to_the_stated_cinema(): void
    {
        $cinemaA = Cinema::factory()->create();
        $roomOfB = ScreeningRoom::factory()->create(); // belongs to a different cinema

        $this->expectException(QueryException::class);
        Showtime::factory()->create(['cinema_id' => $cinemaA->id, 'room_id' => $roomOfB->id]);
    }

    public function test_duplicate_showtime_start_in_same_room_is_rejected(): void
    {
        $first = Showtime::factory()->create();

        $this->expectException(QueryException::class);
        Showtime::factory()->create([
            'cinema_id' => $first->cinema_id,
            'room_id' => $first->room_id,
            'starts_at' => $first->starts_at,
            'ends_at' => $first->ends_at,
        ]);
    }

    public function test_a_seat_cannot_have_two_live_allocations_but_can_be_reallocated_after_release(): void
    {
        $booking = Booking::factory()->create();
        $ss = ShowtimeSeat::factory()->create(['showtime_id' => $booking->showtime_id]);
        $row = ['booking_id' => $booking->id, 'showtime_id' => $booking->showtime_id, 'showtime_seat_id' => $ss->id, 'seat_id' => $ss->seat_id];

        $live = BookingSeat::factory()->create($row);

        try {
            BookingSeat::factory()->create($row);
            $this->fail('Second live allocation of the same showtime seat must be rejected.');
        } catch (QueryException) {
            $this->assertTrue(true);
        }

        $live->update(['released_at' => now()]);
        BookingSeat::factory()->create($row); // allowed once the first is released
        $this->assertSame(2, BookingSeat::where('showtime_seat_id', $ss->id)->count());
    }

    public function test_only_one_live_payment_per_booking(): void
    {
        $booking = Booking::factory()->create();
        $first = Payment::factory()->create(['booking_id' => $booking->id]);

        try {
            Payment::factory()->create(['booking_id' => $booking->id]);
            $this->fail('A second live payment must be rejected.');
        } catch (QueryException) {
            $this->assertTrue(true);
        }

        $first->forceFill(['status' => 'REJECTED'])->save();
        Payment::factory()->create(['booking_id' => $booking->id]); // resubmission after rejection
        $this->assertSame(2, Payment::where('booking_id', $booking->id)->count());
    }

    public function test_showtime_seat_unique_per_showtime(): void
    {
        $ss = ShowtimeSeat::factory()->create();

        $this->expectException(QueryException::class);
        ShowtimeSeat::factory()->create(['showtime_id' => $ss->showtime_id, 'seat_id' => $ss->seat_id]);
    }

    public function test_public_ids_are_generated_ulids(): void
    {
        $booking = Booking::factory()->create();
        $this->assertSame(26, strlen($booking->public_id));
        $this->assertSame($booking->public_id, $booking->getRouteKey());
    }

    public function test_bank_account_number_is_encrypted_at_rest(): void
    {
        $account = \App\Models\BankAccount::factory()->create(['account_number' => '123-456-789012']);
        $raw = DB::table('bank_accounts')->where('id', $account->id)->value('account_number');
        $this->assertStringNotContainsString('123-456', $raw);
        $this->assertSame('123-456-789012', $account->fresh()->account_number);
    }
}
