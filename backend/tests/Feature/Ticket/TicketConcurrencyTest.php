<?php

namespace Tests\Feature\Ticket;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Models\Cinema;
use App\Models\Ticket;
use App\Models\TicketCheckin;
use App\Models\TicketValidationEvent;
use App\Models\User;
use App\Services\Booking\BookingService;
use App\Services\Ticket\TicketIssuanceService;
use Database\Seeders\ReferenceDataSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/** Several scanners (separate PHP processes, real MySQL) read the same QR code at the same instant. */
class TicketConcurrencyTest extends TestCase
{
    /** @var list<User> */
    private array $checkers = [];

    private Ticket $ticket;

    protected function setUp(): void
    {
        parent::setUp();
        $this->truncateAll();
        $this->seed(RolePermissionSeeder::class);
        $this->seed(ReferenceDataSeeder::class);

        $cinema = Cinema::factory()->create();
        $room = \App\Models\ScreeningRoom::factory()->create(['cinema_id' => $cinema->id]);
        \App\Models\Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => \App\Models\SeatCategory::where('key', 'standard')->value('id'), 'row_label' => 'A', 'number' => 1]);
        $movie = \App\Models\Movie::factory()->create(['duration_min' => 100]);
        $showtimes = app(\App\Services\Showtime\ShowtimeService::class);
        $showtime = $showtimes->create(['movie_id' => $movie->id, 'room_id' => $room->id, 'starts_at' => now()->addDays(3)->toIso8601String(), 'prices' => [['category_key' => 'standard', 'price' => 12000]]], null);
        $movie->forceFill(['status' => 'published'])->save();
        $showtimes->publish($showtime, null);

        $customer = User::factory()->create();
        [$booking] = app(BookingService::class)->create($customer, ['showtime' => $showtime->public_id, 'seats' => ['A1']], 'key-ticket-race');
        $booking->forceFill(['status' => BookingStatus::CONFIRMED])->save();
        $this->ticket = app(TicketIssuanceService::class)->issue($booking)->first();

        // Doors are open right now.
        $showtime->forceFill(['starts_at' => now()->addMinutes(30), 'ends_at' => now()->addMinutes(150)])->save();

        foreach (range(1, 6) as $i) {
            $checker = User::factory()->withRole(Role::TicketChecker)->assignedTo($cinema)->create();
            $this->checkers[] = $checker;
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

    public function test_six_scanners_reading_the_same_ticket_at_once_admit_exactly_one_person(): void
    {
        $code = TicketIssuanceService::qrPayload($this->ticket->qr_token_encrypted);
        $start = microtime(true) + 3.0;
        $processes = [];
        foreach ($this->checkers as $checker) {
            $p = new Process(
                [PHP_BINARY, base_path('tests/Support/ticket_worker.php'), (string) $checker->id, $code, (string) $start],
                base_path(),
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
            $this->assertTrue($json['ok'], 'worker failed: '.json_encode($json));
            $results[] = $json['result'];
        }

        $this->assertCount(1, array_keys($results, 'valid'), 'exactly one scanner may admit the ticket: '.json_encode($results));
        $this->assertCount(5, array_keys($results, 'already_used'), json_encode($results));
        $this->assertSame('used', $this->ticket->fresh()->status->value);
        $this->assertSame(1, TicketCheckin::count());
        $this->assertSame(6, TicketValidationEvent::count(), 'every attempt is recorded');
        $this->assertSame(1, TicketValidationEvent::where('outcome', 'valid')->count());
    }
}
