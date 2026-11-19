<?php

namespace Tests\Feature\Booking;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\BookingSeat;
use App\Models\Showtime;
use App\Models\ShowtimeSeat;
use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use Tests\Feature\Showtime\ShowtimeTestCase;
use Tests\TestCase;

/**
 * Real parallelism against real MySQL: several PHP processes each boot the application and try to book at the
 * same instant. These tests commit for real (no wrapping transaction), then clean every table afterwards.
 */
class BookingConcurrencyTest extends TestCase
{
    private Showtime $showtime;

    /** @var list<User> */
    private array $users = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->truncateAll();
        $this->seed(RolePermissionSeeder::class);
        $this->seed(ReferenceDataSeeder::class);

        // Build a showtime straight through the models (committed immediately).
        $cinema = \App\Models\Cinema::factory()->create();
        $room = \App\Models\ScreeningRoom::factory()->create(['cinema_id' => $cinema->id]);
        $cat = \App\Models\SeatCategory::where('key', 'standard')->value('id');
        foreach (range(1, 6) as $n) {
            \App\Models\Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat, 'row_label' => 'A', 'number' => $n]);
        }
        $movie = \App\Models\Movie::factory()->create(['duration_min' => 100]);
        $this->showtime = app(\App\Services\Showtime\ShowtimeService::class)->create([
            'movie_id' => $movie->id, 'room_id' => $room->id, 'starts_at' => now()->addDays(3)->toIso8601String(),
            'prices' => [['category_key' => 'standard', 'price' => 12000]],
        ], null);
        $movie->forceFill(['status' => 'published'])->save();
        app(\App\Services\Showtime\ShowtimeService::class)->publish($this->showtime, null);

        foreach (range(1, 8) as $i) {
            $this->users[] = User::factory()->create();
        }
    }

    protected function tearDown(): void
    {
        $this->truncateAll();
        parent::tearDown();
    }

    private function truncateAll(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (DB::select('SHOW TABLES') as $row) {
            $table = array_values((array) $row)[0];
            if ($table !== 'migrations') {
                DB::table($table)->truncate();
            }
        }
        Schema::enableForeignKeyConstraints();
    }

    /**
     * @param  list<array{user: User, seats: string, key?: string}>  $attempts
     * @return list<array<string, mixed>>
     */
    private function race(array $attempts): array
    {
        $start = microtime(true) + 3.0; // everyone waits for the same instant after booting
        $processes = [];
        foreach ($attempts as $i => $a) {
            $p = new Process(
                [PHP_BINARY, base_path('tests/Support/booking_worker.php'), (string) $a['user']->id, $this->showtime->public_id, $a['seats'], $a['key'] ?? 'race-key-'.$i.'-'.bin2hex(random_bytes(3)), (string) $start],
                base_path(),
                // The child must use the test database and cheap drivers, whatever the parent's phpunit env.
                ['APP_ENV' => 'testing', 'DB_DATABASE' => 'cineora_test', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array', 'BCRYPT_ROUNDS' => '4', 'WORKER_QUERY_DELAY_MS' => '150'],
            );
            $p->setTimeout(60);
            $p->start();
            $processes[] = $p;
        }

        $results = [];
        foreach ($processes as $p) {
            $p->wait();
            $json = json_decode(trim($p->getOutput()), true);
            $this->assertIsArray($json, 'worker produced no JSON: '.$p->getOutput().$p->getErrorOutput());
            $results[] = $json;
        }

        return $results;
    }

    public function test_eight_parallel_requests_for_the_same_seat_produce_exactly_one_booking(): void
    {
        $results = $this->race(array_map(fn ($u) => ['user' => $u, 'seats' => 'A1'], $this->users));

        $won = array_filter($results, fn ($r) => $r['ok']);
        $this->assertCount(1, $won, 'exactly one request may win the seat: '.json_encode($results));
        foreach (array_filter($results, fn ($r) => ! $r['ok']) as $lost) {
            $this->assertSame('seats_unavailable', $lost['code'], 'losers must get a clean conflict, got: '.json_encode($lost));
        }

        $this->assertSame(1, Booking::count());
        $this->assertSame(1, BookingSeat::whereNull('released_at')->count());
        $this->assertSame(1, ShowtimeSeat::where('status', 'held')->count());
    }

    public function test_overlapping_seat_sets_never_double_allocate_or_deadlock_into_errors(): void
    {
        // Pairs overlap in a chain: A1A2, A2A3, A3A4, A4A5, A5A6, A6A1 ... plus reversed order requests.
        $sets = ['A1,A2', 'A2,A3', 'A3,A4', 'A4,A5', 'A5,A6', 'A6,A1', 'A2,A1', 'A4,A3'];
        $attempts = [];
        foreach ($sets as $i => $set) {
            $attempts[] = ['user' => $this->users[$i], 'seats' => $set];
        }

        $results = $this->race($attempts);

        foreach ($results as $r) {
            $this->assertTrue($r['ok'] || $r['code'] === 'seats_unavailable', 'unexpected failure (deadlock or error): '.json_encode($r));
        }
        $this->assertGreaterThanOrEqual(1, count(array_filter($results, fn ($r) => $r['ok'])));

        // Whatever won, no seat is allocated twice and bookings match inventory exactly.
        $live = BookingSeat::whereNull('released_at')->get();
        $this->assertSame($live->count(), $live->pluck('showtime_seat_id')->unique()->count());
        $this->assertSame($live->count(), ShowtimeSeat::where('status', 'held')->count());
        $this->assertSame(Booking::count() * 2, $live->count(), 'every booking holds exactly its two seats, atomically');
    }

    public function test_parallel_retries_with_one_idempotency_key_create_one_booking(): void
    {
        $user = $this->users[0];
        $results = $this->race(array_map(fn ($i) => ['user' => $user, 'seats' => 'A1,A2', 'key' => 'same-order-key-1'], range(1, 6)));

        foreach ($results as $r) {
            $this->assertTrue($r['ok'] || in_array($r['code'], ['App\Exceptions\DomainConflictException'], true), 'unexpected: '.json_encode($r));
        }
        $ok = array_filter($results, fn ($r) => $r['ok']);
        $this->assertGreaterThanOrEqual(1, count($ok));
        $this->assertCount(1, array_unique(array_column($ok, 'id')), 'every successful response refers to the same booking');
        $this->assertSame(1, Booking::count());
        $this->assertSame(2, BookingSeat::whereNull('released_at')->count());
        $this->assertSame(1, DB::table('idempotency_keys')->count());
    }

    public function test_one_customer_cannot_bypass_the_unpaid_limit_by_firing_requests_in_parallel(): void
    {
        config(['cineora.booking.max_active_unpaid_bookings' => 3]);
        $user = $this->users[0];
        $results = $this->race(array_map(fn ($seat) => ['user' => $user, 'seats' => $seat], ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']));

        $this->assertLessThanOrEqual(3, count(array_filter($results, fn ($r) => $r['ok'])));
        $this->assertLessThanOrEqual(3, Booking::where('user_id', $user->id)->count());
    }
}
