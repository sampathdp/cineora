<?php

namespace App\Services\Reporting;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Aggregate, backend-calculated reporting. Every query is narrowed to the cinemas the viewer is assigned to
 * (super admins see all). Reports contain no personal data: only counts and amounts.
 */
class ReportService
{
    public const TYPES = [
        'bookings' => 'Bookings',
        'revenue' => 'Revenue by cinema and date',
        'cinema-performance' => 'Cinema performance',
        'movie-performance' => 'Movie performance',
        'payments' => 'Payment verification summary',
        'checkins' => 'Ticket check-ins',
        'cancellations' => 'Cancellations and refunds',
    ];

    public function __construct(private readonly User $viewer) {}

    /** MySQL expression turning a UTC datetime column into the cinema-local calendar date/month. */
    private function local(string $column, string $group): string
    {
        $offset = Carbon::now(config('cineora.timezone'))->format('P'); // Korea has no DST, so one offset is exact
        $fmt = $group === 'month' ? '%Y-%m' : '%Y-%m-%d';

        return "DATE_FORMAT(CONVERT_TZ({$column}, '+00:00', '{$offset}'), '{$fmt}')";
    }

    private function scope(Builder $q, string $cinemaColumn, ?int $cinemaId): Builder
    {
        $scope = $this->viewer->cinemaScope();
        if ($scope !== null) {
            $q->whereIn($cinemaColumn, $scope->all() ?: [0]);
        }
        if ($cinemaId !== null) {
            $q->where($cinemaColumn, $cinemaId);
        }

        return $q;
    }

    /** @return array{columns: list<array{key: string, label: string}>, rows: list<array<string, scalar|null>>} */
    public function run(string $type, Carbon $from, Carbon $to, ?int $cinemaId, string $group = 'day'): array
    {
        return match ($type) {
            'bookings' => $this->bookings($from, $to, $cinemaId, $group),
            'revenue' => $this->revenue($from, $to, $cinemaId, $group),
            'cinema-performance' => $this->cinemaPerformance($from, $to, $cinemaId),
            'movie-performance' => $this->moviePerformance($from, $to, $cinemaId),
            'payments' => $this->payments($from, $to, $cinemaId),
            'checkins' => $this->checkins($from, $to, $cinemaId, $group),
            'cancellations' => $this->cancellations($from, $to, $cinemaId, $group),
        };
    }

    private function cols(array $pairs): array
    {
        return array_map(fn ($k, $l) => ['key' => $k, 'label' => $l], array_keys($pairs), array_values($pairs));
    }

    private function bookings(Carbon $from, Carbon $to, ?int $cinema, string $group): array
    {
        $period = $this->local('b.created_at', $group);
        $rows = $this->scope(DB::table('bookings as b')->whereBetween('b.created_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw("{$period} as period, COUNT(*) as bookings,
                SUM(b.status IN ('CONFIRMED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED')) as paid,
                SUM(b.status = 'CONFIRMED') as confirmed,
                SUM(b.status IN ('CANCELLED','EXPIRED')) as lost,
                SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total ELSE 0 END) as revenue")
            ->groupBy('period')->orderBy('period')->limit(1000)->get();

        return ['columns' => $this->cols(['period' => $group === 'month' ? 'Month' : 'Date', 'bookings' => 'Bookings', 'confirmed' => 'Confirmed', 'lost' => 'Cancelled or expired', 'revenue' => 'Confirmed revenue (KRW)']),
            'rows' => $rows->map(fn ($r) => ['period' => $r->period, 'bookings' => (int) $r->bookings, 'confirmed' => (int) $r->confirmed, 'lost' => (int) $r->lost, 'revenue' => (int) $r->revenue])->all()];
    }

    private function revenue(Carbon $from, Carbon $to, ?int $cinema, string $group): array
    {
        $period = $this->local('b.confirmed_at', $group);
        $rows = $this->scope(DB::table('bookings as b')->join('cinemas as c', 'c.id', '=', 'b.cinema_id')
            ->where('b.status', 'CONFIRMED')->whereBetween('b.confirmed_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw("c.name as cinema, {$period} as period, COUNT(*) as bookings, SUM(b.subtotal) as gross, SUM(b.discount) as discounts, SUM(b.fee) as fees, SUM(b.total) as revenue")
            ->groupBy('c.name', 'period')->orderBy('period')->orderBy('c.name')->limit(1000)->get();

        return ['columns' => $this->cols(['cinema' => 'Cinema', 'period' => $group === 'month' ? 'Month' : 'Date', 'bookings' => 'Bookings', 'gross' => 'Tickets (KRW)', 'discounts' => 'Discounts (KRW)', 'fees' => 'Fees (KRW)', 'revenue' => 'Revenue (KRW)']),
            'rows' => $rows->map(fn ($r) => ['cinema' => $r->cinema, 'period' => $r->period, 'bookings' => (int) $r->bookings, 'gross' => (int) $r->gross, 'discounts' => (int) $r->discounts, 'fees' => (int) $r->fees, 'revenue' => (int) $r->revenue])->all()];
    }

    private function cinemaPerformance(Carbon $from, Carbon $to, ?int $cinema): array
    {
        $rows = $this->scope(DB::table('bookings as b')->join('cinemas as c', 'c.id', '=', 'b.cinema_id')
            ->where('b.status', 'CONFIRMED')->whereBetween('b.confirmed_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw('c.id as cinema_id, c.name as cinema, COUNT(*) as bookings, SUM(b.total) as revenue')->groupBy('c.id', 'c.name')->orderByDesc('revenue')->get();
        $tickets = $this->scope(DB::table('tickets as t')->join('showtimes as s', 's.id', '=', 't.showtime_id')->whereBetween('t.issued_at', [$from, $to]), 's.cinema_id', $cinema)
            ->selectRaw("s.cinema_id, COUNT(*) as tickets, SUM(t.status = 'used') as used")->groupBy('s.cinema_id')->get()->keyBy('cinema_id');

        return ['columns' => $this->cols(['cinema' => 'Cinema', 'bookings' => 'Confirmed bookings', 'tickets' => 'Tickets issued', 'used' => 'Tickets used', 'revenue' => 'Revenue (KRW)', 'avg_ticket' => 'Average per ticket (KRW)']),
            'rows' => $rows->map(function ($r) use ($tickets) {
                $t = $tickets[$r->cinema_id] ?? null;
                $n = (int) ($t->tickets ?? 0);

                return ['cinema' => $r->cinema, 'bookings' => (int) $r->bookings, 'tickets' => $n, 'used' => (int) ($t->used ?? 0), 'revenue' => (int) $r->revenue, 'avg_ticket' => $n ? intdiv((int) $r->revenue, $n) : 0];
            })->all()];
    }

    private function moviePerformance(Carbon $from, Carbon $to, ?int $cinema): array
    {
        $rows = $this->scope(DB::table('bookings as b')->join('movies as m', 'm.id', '=', 'b.movie_id')
            ->where('b.status', 'CONFIRMED')->whereBetween('b.confirmed_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw('m.id as movie_id, m.title as movie, COUNT(*) as bookings, SUM(b.total) as revenue')->groupBy('m.id', 'm.title')->orderByDesc('revenue')->limit(500)->get();
        $seats = $this->scope(DB::table('booking_seats as bs')->join('bookings as b', 'b.id', '=', 'bs.booking_id')->where('b.status', 'CONFIRMED')->whereBetween('b.confirmed_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw('b.movie_id, COUNT(*) as tickets')->groupBy('b.movie_id')->get()->keyBy('movie_id');
        $shows = $this->scope(DB::table('showtimes as s')->whereBetween('s.starts_at', [$from, $to])->where('s.status', '!=', 'cancelled'), 's.cinema_id', $cinema)
            ->selectRaw('s.movie_id, COUNT(*) as showtimes')->groupBy('s.movie_id')->get()->keyBy('movie_id');

        return ['columns' => $this->cols(['movie' => 'Movie', 'showtimes' => 'Showtimes', 'bookings' => 'Confirmed bookings', 'tickets' => 'Tickets sold', 'revenue' => 'Revenue (KRW)']),
            'rows' => $rows->map(fn ($r) => ['movie' => $r->movie, 'showtimes' => (int) ($shows[$r->movie_id]->showtimes ?? 0), 'bookings' => (int) $r->bookings, 'tickets' => (int) ($seats[$r->movie_id]->tickets ?? 0), 'revenue' => (int) $r->revenue])->all()];
    }

    private function payments(Carbon $from, Carbon $to, ?int $cinema): array
    {
        $base = $this->scope(DB::table('payments as p')->join('bookings as b', 'b.id', '=', 'p.booking_id')->whereBetween('p.submitted_at', [$from, $to]), 'b.cinema_id', $cinema);
        $rows = (clone $base)->selectRaw('p.status, COUNT(*) as payments, SUM(p.expected_amount) as amount, AVG(CASE WHEN p.verified_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, p.submitted_at, p.verified_at) END) as avg_minutes')
            ->groupBy('p.status')->orderBy('p.status')->get();

        return ['columns' => $this->cols(['status' => 'Status', 'payments' => 'Payments', 'amount' => 'Amount due (KRW)', 'avg_minutes' => 'Average minutes to verify']),
            'rows' => $rows->map(fn ($r) => ['status' => $r->status, 'payments' => (int) $r->payments, 'amount' => (int) $r->amount, 'avg_minutes' => $r->avg_minutes !== null ? round((float) $r->avg_minutes, 1) : null])->all()];
    }

    private function checkins(Carbon $from, Carbon $to, ?int $cinema, string $group): array
    {
        $period = $this->local('t.used_at', $group);
        $rows = $this->scope(DB::table('tickets as t')->join('showtimes as s', 's.id', '=', 't.showtime_id')->join('cinemas as c', 'c.id', '=', 's.cinema_id')
            ->where('t.status', 'used')->whereBetween('t.used_at', [$from, $to]), 's.cinema_id', $cinema)
            ->selectRaw("c.name as cinema, {$period} as period, COUNT(*) as checkins")->groupBy('c.name', 'period')->orderBy('period')->orderBy('c.name')->limit(1000)->get();

        return ['columns' => $this->cols(['cinema' => 'Cinema', 'period' => $group === 'month' ? 'Month' : 'Date', 'checkins' => 'Check-ins']),
            'rows' => $rows->map(fn ($r) => ['cinema' => $r->cinema, 'period' => $r->period, 'checkins' => (int) $r->checkins])->all()];
    }

    private function cancellations(Carbon $from, Carbon $to, ?int $cinema, string $group): array
    {
        $period = $this->local('b.updated_at', $group);
        $rows = $this->scope(DB::table('bookings as b')->whereIn('b.status', ['CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'])->whereBetween('b.updated_at', [$from, $to]), 'b.cinema_id', $cinema)
            ->selectRaw("{$period} as period, b.status, COUNT(*) as bookings, SUM(b.total) as amount")->groupBy('period', 'b.status')->orderBy('period')->orderBy('b.status')->limit(1000)->get();

        return ['columns' => $this->cols(['period' => $group === 'month' ? 'Month' : 'Date', 'status' => 'Outcome', 'bookings' => 'Bookings', 'amount' => 'Value (KRW)']),
            'rows' => $rows->map(fn ($r) => ['period' => $r->period, 'status' => $r->status, 'bookings' => (int) $r->bookings, 'amount' => (int) $r->amount])->all()];
    }

    /** Headline numbers and trends for the dashboard. */
    public function dashboard(int $days): array
    {
        $tz = config('cineora.timezone');
        $startLocal = Carbon::now($tz)->startOfDay();
        $todayStart = $startLocal->copy()->utc();
        $trendFrom = $startLocal->copy()->subDays($days - 1)->utc();
        $b = fn () => $this->scope(DB::table('bookings as b'), 'b.cinema_id', null);

        $totals = $b()->selectRaw("COUNT(*) as total, SUM(b.created_at >= ?) as today, SUM(b.status = 'CONFIRMED') as confirmed, SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total ELSE 0 END) as revenue", [$todayStart])->first();
        $pending = $this->scope(DB::table('payments as p')->join('bookings as b', 'b.id', '=', 'p.booking_id')->whereIn('p.status', ['PROOF_SUBMITTED', 'UNDER_REVIEW']), 'b.cinema_id', null)->count();
        $exceptions = $this->scope(DB::table('payments as p')->join('bookings as b', 'b.id', '=', 'p.booking_id')->where('p.status', 'EXCEPTION'), 'b.cinema_id', null)->count();
        $upcoming = $this->scope(DB::table('showtimes as s')->where('s.status', 'on_sale')->where('s.starts_at', '>', now()), 's.cinema_id', null)->count();
        $checkins = $this->scope(DB::table('tickets as t')->join('showtimes as s', 's.id', '=', 't.showtime_id')->where('t.status', 'used'), 's.cinema_id', null)->count();
        $cinemas = $this->viewer->cinemaScope() === null ? DB::table('cinemas')->whereNull('deleted_at')->count() : $this->viewer->cinemaScope()->count();

        $period = $this->local('b.created_at', 'day');
        $trend = $this->scope(DB::table('bookings as b')->where('b.created_at', '>=', $trendFrom), 'b.cinema_id', null)
            ->selectRaw("{$period} as day, COUNT(*) as bookings, SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total ELSE 0 END) as revenue")->groupBy('day')->orderBy('day')->get()->keyBy('day');
        $series = collect(range($days - 1, 0))->map(function ($i) use ($tz, $trend) {
            $d = Carbon::now($tz)->subDays($i)->format('Y-m-d');

            return ['date' => $d, 'bookings' => (int) ($trend[$d]->bookings ?? 0), 'revenue' => (int) ($trend[$d]->revenue ?? 0)];
        })->values()->all();

        return [
            'total_bookings' => (int) $totals->total, 'today_bookings' => (int) $totals->today, 'confirmed_bookings' => (int) $totals->confirmed,
            'pending_verification' => $pending, 'exceptions' => $exceptions, 'verified_revenue' => (int) $totals->revenue,
            'upcoming_showtimes' => $upcoming, 'movies' => DB::table('movies')->where('status', 'published')->whereNull('deleted_at')->count(),
            'cinemas' => $cinemas, 'ticket_checkins' => $checkins, 'currency' => config('cineora.currency'), 'trend' => $series,
        ];
    }

    /** Neutralises spreadsheet formula injection: a cell starting with = + - @ would be executed by Excel. */
    public static function csvCell(mixed $v): string
    {
        $s = (string) ($v ?? '');

        return $s !== '' && str_contains("=+-@\t\r", $s[0]) ? "'".$s : $s;
    }

    /** @return Collection<int, array<string, scalar|null>> */
    public static function asCollection(array $report): Collection
    {
        return collect($report['rows']);
    }
}
