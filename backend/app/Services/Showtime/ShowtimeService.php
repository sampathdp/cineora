<?php

namespace App\Services\Showtime;

use App\Enums\BookingStatus;
use App\Enums\MovieStatus;
use App\Enums\ShowtimeSeatStatus;
use App\Enums\ShowtimeStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Movie;
use App\Models\ScreeningRoom;
use App\Models\SeatCategory;
use App\Models\Showtime;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Schedules screenings and owns their pricing and seat inventory.
 *
 * Invariants:
 *  - a showtime's room belongs to its cinema (also enforced by a composite foreign key);
 *  - two showtimes in one room never overlap, including the turnaround buffer (checked under a room lock);
 *  - every seat category in the room has a price, and every seat has a per-showtime price snapshot;
 *  - schedule, room, movie and prices of a showtime with live bookings are immutable.
 */
class ShowtimeService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{movie_id: int, room_id: int, starts_at: string, sales_cutoff_minutes?: int, prices: list<array{category_key: string, price: int}>}  $data
     */
    public function create(array $data, ?User $actor): Showtime
    {
        $movie = $this->movie($data['movie_id']);
        $room = $this->room($data['room_id']);
        $start = Carbon::parse($data['starts_at'])->utc();
        $this->assertStartAllowed($start);

        try {
            return DB::transaction(function () use ($data, $actor, $movie, $room, $start) {
                // Serialise all scheduling in this room.
                ScreeningRoom::whereKey($room->id)->lockForUpdate()->first();
                $end = $this->endsAt($movie, $start);
                $this->assertNoOverlap($room, $start, $end, null);

                $showtime = new Showtime([
                    'movie_id' => $movie->id, 'cinema_id' => $room->cinema_id, 'room_id' => $room->id,
                    'starts_at' => $start, 'ends_at' => $end,
                    'sales_cutoff_minutes' => $data['sales_cutoff_minutes'] ?? 15, 'created_by' => $actor?->id,
                ]);
                $showtime->status = ShowtimeStatus::Draft;
                $showtime->save();

                $this->applyPrices($showtime, $room, $data['prices']);
                $this->buildInventory($showtime);
                $this->audit->log('showtime.created', $actor, 'showtime', $showtime->public_id, ['cinema' => $room->cinema->public_id, 'movie' => $movie->public_id, 'starts_at' => $start->toIso8601String()]);

                return $showtime->load($this->relations());
            });
        } catch (QueryException $e) {
            // The (room, starts_at) unique index is the final guard against a concurrent identical slot.
            if (str_contains($e->getMessage(), 'showtimes_live_slot_unique')) {
                throw ValidationException::withMessages(['starts_at' => ['A showtime already starts at this time in this room.']]);
            }
            throw $e;
        }
    }

    /** Reschedule / change movie, room or cut-off. Blocked once live bookings exist. */
    public function update(Showtime $showtime, array $data, ?User $actor): Showtime
    {
        $this->assertEditable($showtime);
        $touchesSchedule = isset($data['movie_id']) || isset($data['room_id']) || isset($data['starts_at']);

        return DB::transaction(function () use ($showtime, $data, $actor, $touchesSchedule) {
            $showtime = Showtime::whereKey($showtime->id)->lockForUpdate()->firstOrFail();
            $changes = [];

            if ($touchesSchedule) {
                $this->assertNoLiveBookings($showtime, 'Schedule, room and movie cannot change while bookings exist.');

                $movie = isset($data['movie_id']) ? $this->movie($data['movie_id']) : $showtime->movie;
                $room = isset($data['room_id']) ? $this->room($data['room_id']) : $showtime->room;
                $start = isset($data['starts_at']) ? Carbon::parse($data['starts_at'])->utc() : $showtime->starts_at->copy();
                $this->assertStartAllowed($start);

                ScreeningRoom::whereKey($room->id)->lockForUpdate()->first();
                $end = $this->endsAt($movie, $start);
                $this->assertNoOverlap($room, $start, $end, $showtime->id);

                $roomChanged = $room->id !== $showtime->room_id;
                $showtime->forceFill(['movie_id' => $movie->id, 'cinema_id' => $room->cinema_id, 'room_id' => $room->id, 'starts_at' => $start, 'ends_at' => $end]);
                if ($roomChanged) {
                    // A different room means a different seat set and category set: rebuild prices and inventory.
                    $old = $showtime->prices()->get()->mapWithKeys(fn ($p) => [$p->category->key => (int) $p->price])->all();
                    $showtime->seats()->delete();
                    $showtime->prices()->delete();
                    $showtime->save();
                    $this->applyPrices($showtime, $room, $data['prices'] ?? $this->carryOverPrices($room, $old));
                    $this->buildInventory($showtime);
                }
                $changes = array_merge($changes, array_keys(array_intersect_key($data, array_flip(['movie_id', 'room_id', 'starts_at']))));
            }
            if (isset($data['sales_cutoff_minutes'])) {
                $showtime->sales_cutoff_minutes = $data['sales_cutoff_minutes'];
                $changes[] = 'sales_cutoff_minutes';
            }
            $showtime->save();
            $this->audit->log('showtime.updated', $actor, 'showtime', $showtime->public_id, ['fields' => $changes]);

            return $showtime->load($this->relations());
        });
    }

    /** Replace prices for every category. Not allowed once any live booking exists (historic prices are snapshotted). */
    public function setPrices(Showtime $showtime, array $prices, ?User $actor): Showtime
    {
        $this->assertEditable($showtime);

        return DB::transaction(function () use ($showtime, $prices, $actor) {
            $showtime = Showtime::whereKey($showtime->id)->lockForUpdate()->firstOrFail();
            $this->assertNoLiveBookings($showtime, 'Prices cannot change while bookings exist for this showtime.');

            $before = $showtime->prices()->with('category')->get()->mapWithKeys(fn ($p) => [$p->category->key => (int) $p->price])->all();
            $this->applyPrices($showtime, $showtime->room, $prices);
            $this->repriceInventory($showtime);
            $after = $showtime->prices()->with('category')->get()->mapWithKeys(fn ($p) => [$p->category->key => (int) $p->price])->all();
            $this->audit->log('showtime.prices_changed', $actor, 'showtime', $showtime->public_id, ['before' => $before, 'after' => $after]);

            return $showtime->load($this->relations());
        });
    }

    public function publish(Showtime $showtime, ?User $actor): Showtime
    {
        return DB::transaction(function () use ($showtime, $actor) {
            $showtime = Showtime::whereKey($showtime->id)->lockForUpdate()->firstOrFail();
            if ($showtime->status !== ShowtimeStatus::Draft) {
                throw new DomainConflictException('Only draft showtimes can be put on sale.', 'invalid_state');
            }
            if ($showtime->movie->status !== MovieStatus::Published) {
                throw ValidationException::withMessages(['movie' => ['The movie must be published first.']]);
            }
            if (! $showtime->room->is_active) {
                throw ValidationException::withMessages(['room' => ['The room is not active.']]);
            }
            if ($showtime->salesClosesAt()->lte(now())) {
                throw ValidationException::withMessages(['starts_at' => ['Sales would already be closed for this time.']]);
            }
            if ($showtime->seats()->count() === 0) {
                throw ValidationException::withMessages(['room' => ['The room has no active seats.']]);
            }

            $showtime->status = ShowtimeStatus::OnSale;
            $showtime->save();
            $this->audit->log('showtime.published', $actor, 'showtime', $showtime->public_id);

            return $showtime->load($this->relations());
        });
    }

    /** Cancelling with live bookings needs the refund workflow (later phase), so it is refused here. */
    public function cancel(Showtime $showtime, ?User $actor): Showtime
    {
        return DB::transaction(function () use ($showtime, $actor) {
            $showtime = Showtime::whereKey($showtime->id)->lockForUpdate()->firstOrFail();
            if (! in_array($showtime->status, [ShowtimeStatus::Draft, ShowtimeStatus::OnSale], true)) {
                throw new DomainConflictException('This showtime can no longer be cancelled.', 'invalid_state');
            }
            $this->assertNoLiveBookings($showtime, 'This showtime has bookings. Cancel or refund them first.');

            $showtime->status = ShowtimeStatus::Cancelled;
            $showtime->save();
            $showtime->seats()->update(['status' => ShowtimeSeatStatus::Blocked->value]);
            $this->audit->log('showtime.cancelled', $actor, 'showtime', $showtime->public_id);

            return $showtime->load($this->relations());
        });
    }

    public function relations(): array
    {
        return ['movie', 'cinema', 'room', 'prices.category'];
    }

    // --- internals ----------------------------------------------------------

    private function movie(int $id): Movie
    {
        $movie = Movie::find($id);
        if (! $movie || $movie->status === MovieStatus::Archived) {
            throw ValidationException::withMessages(['movie_id' => ['Choose an available movie.']]);
        }

        return $movie;
    }

    private function room(int $id): ScreeningRoom
    {
        $room = ScreeningRoom::with('cinema')->find($id);
        if (! $room || ! $room->is_active || ! $room->cinema?->is_active) {
            throw ValidationException::withMessages(['room_id' => ['Choose an active room.']]);
        }

        return $room;
    }

    private function endsAt(Movie $movie, Carbon $start): Carbon
    {
        return $start->copy()->addMinutes($movie->duration_min + config('cineora.showtime.buffer_minutes'));
    }

    private function assertStartAllowed(Carbon $start): void
    {
        if ($start->lte(now())) {
            throw ValidationException::withMessages(['starts_at' => ['The start time must be in the future.']]);
        }
        if ($start->gt(now()->addDays(config('cineora.showtime.max_days_ahead')))) {
            throw ValidationException::withMessages(['starts_at' => ['The start time is too far ahead.']]);
        }
    }

    private function assertNoOverlap(ScreeningRoom $room, Carbon $start, Carbon $end, ?int $ignoreId): void
    {
        $clash = Showtime::query()
            ->where('room_id', $room->id)
            ->where('status', '!=', ShowtimeStatus::Cancelled->value)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->where('starts_at', '<', $end)->where('ends_at', '>', $start)
            ->with('movie')->first();

        if ($clash) {
            throw ValidationException::withMessages(['starts_at' => [
                "This overlaps '{$clash->movie->title}' ({$clash->starts_at->toIso8601String()}) in the same room, including the "
                .config('cineora.showtime.buffer_minutes').' minute turnaround.',
            ]]);
        }
    }

    private function assertEditable(Showtime $showtime): void
    {
        if (! in_array($showtime->status, [ShowtimeStatus::Draft, ShowtimeStatus::OnSale], true)) {
            throw new DomainConflictException('This showtime can no longer be changed.', 'invalid_state');
        }
        if ($showtime->starts_at->lte(now())) {
            throw new DomainConflictException('This showtime has already started.', 'already_started');
        }
    }

    private function assertNoLiveBookings(Showtime $showtime, string $message): void
    {
        $live = collect(BookingStatus::cases())->filter->holdsSeats()->map->value->all();
        if ($showtime->bookings()->whereIn('status', $live)->exists()) {
            throw new DomainConflictException($message, 'has_active_bookings');
        }
    }

    /**
     * Validates that `prices` covers exactly the categories used by the room's active seats, then upserts them.
     *
     * @param  list<array{category_key: string, price: int}>  $prices
     */
    private function applyPrices(Showtime $showtime, ScreeningRoom $room, array $prices): void
    {
        $needed = SeatCategory::query()
            ->whereIn('id', $room->seats()->where('is_active', true)->select('seat_category_id'))
            ->get()->keyBy('key');
        if ($needed->isEmpty()) {
            throw ValidationException::withMessages(['room_id' => ['The room has no active seats. Define its seat layout first.']]);
        }

        $given = [];
        foreach ($prices as $row) {
            if (isset($given[$row['category_key']])) {
                throw ValidationException::withMessages(['prices' => ["Duplicate price for '{$row['category_key']}'."]]);
            }
            $given[$row['category_key']] = (int) $row['price'];
        }
        foreach (array_diff_key($given, $needed->all()) as $key => $_) {
            throw ValidationException::withMessages(['prices' => ["'{$key}' is not a seat category used by this room."]]);
        }
        foreach ($needed as $key => $_) {
            if (! isset($given[$key])) {
                throw ValidationException::withMessages(['prices' => ["A price is required for '{$key}'."]]);
            }
        }

        // The table has a composite key, which Eloquent cannot update; write it with a single upsert.
        $now = now();
        DB::table('showtime_seat_prices')->upsert(
            collect($given)->map(fn ($price, $key) => [
                'showtime_id' => $showtime->id, 'seat_category_id' => $needed[$key]->id, 'price' => $price, 'created_at' => $now, 'updated_at' => $now,
            ])->values()->all(),
            ['showtime_id', 'seat_category_id'],
            ['price', 'updated_at'],
        );
        $showtime->prices()->whereNotIn('seat_category_id', $needed->pluck('id'))->delete();
    }

    private function carryOverPrices(ScreeningRoom $room, array $old): array
    {
        // Keep prices for categories that still exist; the caller's validation then demands any that are missing.
        return collect($old)->map(fn ($price, $key) => ['category_key' => $key, 'price' => $price])->values()->all();
    }

    /** One inventory row per active seat, with the category price copied as a snapshot. */
    private function buildInventory(Showtime $showtime): void
    {
        $prices = $showtime->prices()->pluck('price', 'seat_category_id');
        $now = now();
        $rows = $showtime->room->seats()->where('is_active', true)->get(['id', 'seat_category_id'])->map(fn ($seat) => [
            'showtime_id' => $showtime->id, 'seat_id' => $seat->id, 'price' => $prices[$seat->seat_category_id],
            'status' => ShowtimeSeatStatus::Available->value, 'created_at' => $now, 'updated_at' => $now,
        ])->all();

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('showtime_seats')->insert($chunk);
        }
    }

    private function repriceInventory(Showtime $showtime): void
    {
        DB::table('showtime_seats as ss')
            ->join('seats as s', 's.id', '=', 'ss.seat_id')
            ->join('showtime_seat_prices as p', fn ($j) => $j->on('p.seat_category_id', '=', 's.seat_category_id')->where('p.showtime_id', '=', $showtime->id))
            ->where('ss.showtime_id', $showtime->id)
            ->update(['ss.price' => DB::raw('p.price'), 'ss.updated_at' => now()]);
    }
}
