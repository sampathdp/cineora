<?php

namespace Tests\Feature\Showtime;

use App\Models\AuditLog;
use App\Models\Showtime;

class ShowtimeBulkTest extends ShowtimeTestCase
{
    private function bulk(array $startsAt, array $over = []): array
    {
        $payload = array_merge(['starts_at' => $startsAt], array_diff_key($this->payload($over), ['starts_at' => true]));

        return $this->postJson('/api/v1/admin/showtimes/bulk', $payload)->assertSuccessful()->json('data');
    }

    public function test_creates_each_slot_and_skips_clashes_without_failing_the_batch(): void
    {
        $this->as($this->admin());
        $data = $this->bulk([$this->at(3, '10:00'), $this->at(3, '10:30'), $this->at(4, '10:00')]);

        $this->assertCount(2, $data['created']);
        $this->assertCount(1, $data['skipped']);
        $this->assertSame($this->at(3, '10:30'), $data['skipped'][0]['starts_at']);
        $this->assertStringContainsString('overlaps', $data['skipped'][0]['reason']);
        $this->assertSame(2, Showtime::count());
        $this->assertSame(2, AuditLog::where('action', 'showtime.created')->count());
        // Same inventory as a single create: every active seat gets a priced row.
        foreach (Showtime::all() as $st) {
            $this->assertSame(6, $st->seats()->count());
        }
    }

    public function test_all_skipped_returns_ok_with_reasons(): void
    {
        $this->as($this->admin());
        $this->createShowtime(['starts_at' => $this->at(3, '10:00')]);

        $data = $this->bulk([$this->at(3, '10:00')]);
        $this->assertSame([], $data['created']);
        $this->assertCount(1, $data['skipped']);
    }

    public function test_validation_and_access(): void
    {
        $this->as($this->admin());
        $send = fn (array $startsAt) => $this->postJson('/api/v1/admin/showtimes/bulk', ['starts_at' => $startsAt] + array_diff_key($this->payload(), ['starts_at' => true]));

        $send([])->assertStatus(422);
        $send(['tomorrow'])->assertStatus(422);
        $send([$this->at(3), $this->at(3)])->assertStatus(422); // duplicates
        $send(array_map(fn ($i) => $this->at(3 + intdiv($i, 20), sprintf('%02d:%02d', 0, $i % 20)), range(0, 100)))->assertStatus(422); // 101 slots
        $this->assertSame(0, Showtime::count());

        $this->as($this->customer());
        $send([$this->at(3)])->assertForbidden();
        $this->assertSame(0, Showtime::count());
    }
}
