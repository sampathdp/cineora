<?php

namespace App\Services\Catalog;

use App\Exceptions\DomainConflictException;
use App\Models\Cinema;
use App\Models\ScreeningRoom;
use App\Models\Seat;
use App\Models\SeatCategory;
use App\Models\Showtime;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoomService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function create(Cinema $cinema, array $data, User $actor): ScreeningRoom
    {
        $room = $cinema->rooms()->create(array_intersect_key($data, array_flip(['name', 'screen_type', 'is_active'])));
        $this->audit->log('room.created', $actor, 'room', $room->public_id, ['cinema' => $cinema->public_id]);

        return $room;
    }

    public function update(ScreeningRoom $room, array $data, User $actor): ScreeningRoom
    {
        $room->update(array_intersect_key($data, array_flip(['name', 'screen_type', 'is_active'])));
        $this->audit->log('room.updated', $actor, 'room', $room->public_id, ['fields' => array_keys($data)]);

        return $room;
    }

    /**
     * Permanently deletes a room with its seats and every showtime (prices + seat inventory) scheduled in it.
     * Refused once any booking references one of its showtimes: bookings, payments and tickets keep that history.
     */
    public function delete(ScreeningRoom $room, User $actor): void
    {
        DB::transaction(function () use ($room, $actor) {
            ScreeningRoom::whereKey($room->id)->lockForUpdate()->first();
            if (DB::table('bookings')->whereIn('showtime_id', Showtime::where('room_id', $room->id)->select('id'))->exists()) {
                throw new DomainConflictException('This hall has bookings. Deactivate it instead of deleting.', 'has_bookings');
            }
            $this->purge($room);
            $this->audit->log('room.deleted', $actor, 'room', $room->public_id);
        });
    }

    /** Removes a room's showtimes, seats and the room itself. Caller must hold a transaction and have checked bookings. */
    public function purge(ScreeningRoom $room): void
    {
        $showIds = Showtime::where('room_id', $room->id)->pluck('id');
        DB::table('showtime_seats')->whereIn('showtime_id', $showIds)->delete();
        DB::table('showtime_seat_prices')->whereIn('showtime_id', $showIds)->delete();
        Showtime::whereIn('id', $showIds)->delete();
        $room->seats()->delete();
        $room->forceDelete(); // hard delete: frees the hall name and leaves no orphan row behind
    }

    /**
     * Replaces a room's seat layout with the given list.
     *
     * Seats keep their id when (row, number) matches, so history, showtime inventory and tickets stay attached.
     * A seat missing from the new layout is deleted only if nothing references it; otherwise it is deactivated.
     * A seat whose category changes is refused while any showtime inventory exists for it, because prices
     * of existing showtimes were derived from the old category.
     *
     * @param  list<array{row_label: string, number: int, category_key: string, x?: int, y?: int}>  $seats
     * @return array{created: int, updated: int, removed: int, deactivated: int}
     */
    public function replaceLayout(ScreeningRoom $room, array $seats, User $actor): array
    {
        return DB::transaction(function () use ($room, $seats, $actor) {
            ScreeningRoom::whereKey($room->id)->lockForUpdate()->first();

            $categories = SeatCategory::query()
                ->where(fn ($q) => $q->whereNull('cinema_id')->orWhere('cinema_id', $room->cinema_id))
                ->get()->keyBy('key');

            $incoming = [];
            foreach ($seats as $s) {
                $cat = $categories[$s['category_key']] ?? null;
                if (! $cat) {
                    throw ValidationException::withMessages(['seats' => ["Unknown seat category '{$s['category_key']}'."]]);
                }
                $key = strtoupper($s['row_label']).'|'.$s['number'];
                if (isset($incoming[$key])) {
                    throw ValidationException::withMessages(['seats' => ["Duplicate seat {$s['row_label']}{$s['number']}."]]);
                }
                $incoming[$key] = ['row_label' => strtoupper($s['row_label']), 'number' => (int) $s['number'], 'seat_category_id' => $cat->id, 'x' => $s['x'] ?? null, 'y' => $s['y'] ?? null, 'is_active' => (bool) ($s['is_active'] ?? true)];
            }

            /** @var Collection<int, Seat> $existing */
            $existing = $room->seats()->get()->keyBy(fn (Seat $s) => $s->row_label.'|'.$s->number);
            $inventory = DB::table('showtime_seats')->whereIn('seat_id', $existing->pluck('id'))->distinct()->pluck('seat_id')->flip();
            $booked = DB::table('showtime_seats')
                ->whereIn('seat_id', $existing->pluck('id'))
                ->where(fn ($q) => $q->whereIn('status', ['held', 'sold'])->orWhereNotNull('booking_id'))
                ->pluck('seat_id')
                ->flip();

            $result = ['created' => 0, 'updated' => 0, 'removed' => 0, 'deactivated' => 0];

            foreach ($incoming as $key => $row) {
                $seat = $existing[$key] ?? null;
                if (! $seat) {
                    $newSeat = $room->seats()->create($row);
                    $result['created']++;

                    if ($newSeat->is_active) {
                        $this->syncIntoFutureShowtimes($room, $newSeat, $categories);
                    }

                    continue;
                }

                // If seat has active bookings, its category cannot change
                if ($seat->seat_category_id !== $row['seat_category_id'] && isset($booked[$seat->id])) {
                    throw ValidationException::withMessages(['seats' => ["Seat {$seat->row_label}{$seat->number} has active ticket bookings; its category cannot change."]]);
                }

                $catChanged = $seat->seat_category_id !== $row['seat_category_id'];
                $reactivated = ! $seat->is_active && $row['is_active'];
                $disabled = $seat->is_active && ! $row['is_active'];
                $seat->fill($row);
                if ($seat->isDirty()) {
                    $seat->save();

                    // A disabled seat keeps its number reserved but is taken off sale.
                    if ($disabled) {
                        $this->pullFromSale($seat);
                        $result['deactivated']++;

                        continue;
                    }
                    $result['updated']++;

                    // A re-enabled seat goes back on sale in upcoming showtimes.
                    if ($reactivated) {
                        $this->syncIntoFutureShowtimes($room, $seat, $categories);
                    }

                    // Reprice unbooked showtime seats for this seat if category changed
                    if ($catChanged) {
                        $categoryPrices = DB::table('showtime_seat_prices')
                            ->where('seat_category_id', $row['seat_category_id'])
                            ->pluck('price', 'showtime_id');
                        $defaultPrice = $categories->firstWhere('id', $row['seat_category_id'])->default_price ?? 12000;

                        $availableSeats = DB::table('showtime_seats')
                            ->where('seat_id', $seat->id)
                            ->where('status', 'available')
                            ->whereNull('booking_id')
                            ->get(['id', 'showtime_id']);

                        foreach ($availableSeats as $ss) {
                            $price = $categoryPrices[$ss->showtime_id] ?? $defaultPrice;
                            DB::table('showtime_seats')->where('id', $ss->id)->update(['price' => $price, 'updated_at' => now()]);
                        }
                    }
                }
            }

            foreach ($existing as $key => $seat) {
                if (isset($incoming[$key])) {
                    continue;
                }
                if (isset($inventory[$seat->id])) {
                    $this->pullFromSale($seat);
                    if ($seat->is_active) {
                        $seat->update(['is_active' => false]);
                    }
                    $result['deactivated']++;
                } else {
                    $seat->delete();
                    $result['removed']++;
                }
            }

            $this->audit->log('room.layout_updated', $actor, 'room', $room->public_id, $result);

            return $result;
        });
    }

    /** Removes a seat's unsold showtime inventory: blocks rows referenced by past holds/bookings (FK restrict), deletes the rest. */
    private function pullFromSale(Seat $seat): void
    {
        $free = DB::table('showtime_seats')->where('seat_id', $seat->id)->where('status', 'available')->whereNull('booking_id');
        $referenced = fn ($q) => $q->whereExists(fn ($e) => $e->from('seat_holds')->whereColumn('seat_holds.showtime_seat_id', 'showtime_seats.id'))
            ->orWhereExists(fn ($e) => $e->from('booking_seats')->whereColumn('booking_seats.showtime_seat_id', 'showtime_seats.id'));
        (clone $free)->where($referenced)->update(['status' => 'blocked', 'updated_at' => now()]);
        (clone $free)->whereNot($referenced)->delete();
    }

    /** Puts a seat on sale in every upcoming, non-cancelled showtime of the room (adds missing rows, unblocks blocked ones). */
    private function syncIntoFutureShowtimes(ScreeningRoom $room, Seat $seat, $categories): void
    {
        $showIds = Showtime::where('room_id', $room->id)
            ->where('starts_at', '>', now())
            ->whereIn('status', ['draft', 'on_sale'])
            ->pluck('id');
        if ($showIds->isEmpty()) {
            return;
        }

        DB::table('showtime_seats')->where('seat_id', $seat->id)->whereIn('showtime_id', $showIds)
            ->where('status', 'blocked')->whereNull('booking_id')
            ->update(['status' => 'available', 'updated_at' => now()]);

        $prices = DB::table('showtime_seat_prices')
            ->where('seat_category_id', $seat->seat_category_id)
            ->whereIn('showtime_id', $showIds)
            ->pluck('price', 'showtime_id');
        $defaultPrice = $categories->firstWhere('id', $seat->seat_category_id)->default_price ?? 12000;
        $now = now();

        DB::table('showtime_seats')->insertOrIgnore($showIds->map(fn ($id) => [
            'showtime_id' => $id,
            'seat_id' => $seat->id,
            'price' => $prices[$id] ?? $defaultPrice,
            'status' => 'available',
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());
    }
}
