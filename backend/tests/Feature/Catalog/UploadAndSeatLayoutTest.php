<?php

namespace Tests\Feature\Catalog;

use App\Enums\MovieStatus;
use App\Enums\Role;
use App\Models\Cinema;
use App\Models\ScreeningRoom;
use App\Models\Seat;
use App\Models\Showtime;
use App\Models\ShowtimeSeat;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class UploadAndSeatLayoutTest extends CatalogTestCase
{
    private function cm()
    {
        return $this->staff(Role::ContentManager);
    }

    public function test_valid_poster_is_reencoded_stored_under_a_random_name_and_old_file_removed(): void
    {
        $movie = $this->movie(['status' => MovieStatus::Draft, 'poster_path' => null]);
        $url = "/api/v1/admin/movies/{$movie->public_id}/images/poster";

        $r = $this->as($this->cm())->post($url, ['image' => UploadedFile::fake()->image('../../evil name.php.jpg', 800, 1200)], ['Accept' => 'application/json'])->assertOk();

        $path = $movie->fresh()->poster_path;
        $this->assertMatchesRegularExpression('#^movies/posters/[0-9a-z]{26}\.jpg$#', $path);
        $this->assertStringNotContainsString('evil', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertStringContainsString($path, $r->json('data.poster_url'));

        $this->post($url, ['image' => UploadedFile::fake()->image('b.png', 600, 900)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($path);
        $this->assertStringEndsWith('.png', $movie->fresh()->poster_path);
    }

    public function test_non_images_and_disguised_files_are_rejected(): void
    {
        $movie = $this->movie();
        $url = "/api/v1/admin/movies/{$movie->public_id}/images/poster";
        $this->as($this->cm());
        $before = $movie->poster_path;

        $bad = [
            'php as png' => UploadedFile::fake()->createWithContent('shell.png', '<?php system($_GET["c"]); ?>'),
            'html as jpg' => UploadedFile::fake()->createWithContent('page.jpg', '<html><script>alert(1)</script></html>'),
            'svg' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            'gif' => UploadedFile::fake()->createWithContent('a.gif', base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')),
            'pdf' => UploadedFile::fake()->createWithContent('doc.pdf', "%PDF-1.4\n%fake"),
            'exe' => UploadedFile::fake()->createWithContent('run.jpg', "MZ\x90\x00\x03"),
            'too small' => UploadedFile::fake()->image('tiny.jpg', 20, 20),
            'empty' => UploadedFile::fake()->createWithContent('empty.png', ''),
        ];
        foreach ($bad as $label => $file) {
            $this->post($url, ['image' => $file], ['Accept' => 'application/json'])->assertStatus(422);
            $this->assertSame($before, $movie->fresh()->poster_path, "$label must not change the poster");
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_oversized_file_and_decompression_bomb_dimensions_are_rejected(): void
    {
        $movie = $this->movie();
        $url = "/api/v1/admin/movies/{$movie->public_id}/images/banner";
        $this->as($this->cm());

        $this->post($url, ['image' => UploadedFile::fake()->create('big.jpg', 6000, 'image/jpeg')], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post($url, ['image' => UploadedFile::fake()->image('huge.png', 5200, 120)], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_payload_appended_to_a_real_image_does_not_survive_reencoding(): void
    {
        $movie = $this->movie();
        $png = UploadedFile::fake()->image('ok.png', 300, 300);
        file_put_contents($png->getRealPath(), '<?php echo "pwned"; ?>', FILE_APPEND);

        $this->as($this->cm())->post("/api/v1/admin/movies/{$movie->public_id}/images/poster", ['image' => $png], ['Accept' => 'application/json'])->assertOk();

        $stored = Storage::disk('public')->get($movie->fresh()->poster_path);
        $this->assertStringNotContainsString('<?php', $stored);
        $this->assertNotFalse(@imagecreatefromstring($stored));
    }

    public function test_unknown_image_kind_and_wrong_role_are_refused(): void
    {
        $movie = $this->movie();
        $file = UploadedFile::fake()->image('a.jpg', 400, 400);
        $this->as($this->cm())->post("/api/v1/admin/movies/{$movie->public_id}/images/../../hack", ['image' => $file], ['Accept' => 'application/json'])->assertNotFound();
        $this->post("/api/v1/admin/movies/{$movie->public_id}/images/script", ['image' => $file], ['Accept' => 'application/json'])->assertNotFound();
        $this->as($this->staff(Role::PaymentVerifier))->post("/api/v1/admin/movies/{$movie->public_id}/images/poster", ['image' => $file], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_cinema_images_can_be_added_and_removed_only_from_their_own_cinema(): void
    {
        $a = Cinema::factory()->create();
        $b = Cinema::factory()->create();
        $this->as($this->staff(Role::SuperAdmin));

        $this->post("/api/v1/admin/cinemas/{$a->public_id}/images", ['image' => UploadedFile::fake()->image('l.jpg', 800, 500), 'alt' => 'Lobby'], ['Accept' => 'application/json'])->assertCreated();
        $imageId = $a->images()->firstOrFail()->id;
        $path = $a->images()->first()->path;
        Storage::disk('public')->assertExists($path);

        $this->deleteJson("/api/v1/admin/cinemas/{$b->public_id}/images/{$imageId}")->assertNotFound();
        Storage::disk('public')->assertExists($path);
        $this->deleteJson("/api/v1/admin/cinemas/{$a->public_id}/images/{$imageId}")->assertOk();
        Storage::disk('public')->assertMissing($path);
    }

    // --- Seat layouts ------------------------------------------------------------

    private function layout(int $rows, int $perRow, string $cat = 'standard'): array
    {
        $seats = [];
        foreach (range(0, $rows - 1) as $r) {
            foreach (range(1, $perRow) as $n) {
                $seats[] = ['row_label' => chr(65 + $r), 'number' => $n, 'category_key' => $cat];
            }
        }

        return $seats;
    }

    public function test_layout_is_created_and_reported_back(): void
    {
        $room = ScreeningRoom::factory()->create();
        $this->as($this->staff(Role::SuperAdmin));

        $this->putJson("/api/v1/admin/rooms/{$room->public_id}/seats", ['seats' => $this->layout(3, 4)])
            ->assertOk()->assertJsonPath('data.created', 12);

        $this->assertSame(12, $room->seats()->count());
        $r = $this->getJson("/api/v1/admin/rooms/{$room->public_id}/seats")->assertOk();
        $this->assertSame('A', $r->json('data.seats.0.row_label'));
        $this->assertSame('standard', $r->json('data.seats.0.category_key'));
    }

    public function test_layout_validation(): void
    {
        $room = ScreeningRoom::factory()->create();
        $this->as($this->staff(Role::SuperAdmin));
        $url = "/api/v1/admin/rooms/{$room->public_id}/seats";

        $this->putJson($url, ['seats' => []])->assertStatus(422);
        $this->putJson($url, ['seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'vip-nonexistent']]])->assertStatus(422);
        $this->putJson($url, ['seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'standard'], ['row_label' => 'a', 'number' => 1, 'category_key' => 'standard']]])->assertStatus(422);
        $this->putJson($url, ['seats' => [['row_label' => 'A1', 'number' => 1, 'category_key' => 'standard']]])->assertStatus(422);
        $this->putJson($url, ['seats' => array_fill(0, 601, ['row_label' => 'A', 'number' => 1, 'category_key' => 'standard'])])->assertStatus(422);
        $this->assertSame(0, $room->seats()->count());
    }

    public function test_relayout_keeps_seat_ids_removes_unused_and_deactivates_seats_with_inventory(): void
    {
        $show = Showtime::factory()->create();
        $room = ScreeningRoom::find($show->room_id);
        $cat = $this->standardCategory();
        $kept = Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 1]);
        $sold = Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 2]);
        $unused = Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $cat->id, 'row_label' => 'A', 'number' => 3]);
        ShowtimeSeat::factory()->create(['showtime_id' => $show->id, 'seat_id' => $sold->id]);

        $r = $this->as($this->staff(Role::SuperAdmin))->putJson("/api/v1/admin/rooms/{$room->public_id}/seats", [
            'seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'standard'], ['row_label' => 'B', 'number' => 1, 'category_key' => 'standard']],
        ])->assertOk();

        $this->assertSame(['created' => 1, 'updated' => 0, 'removed' => 1, 'deactivated' => 1], $r->json('data'));
        $this->assertTrue(Seat::whereKey($kept->id)->exists(), 'existing seats keep their id');
        $this->assertFalse(Seat::whereKey($unused->id)->exists());
        $this->assertFalse((bool) Seat::find($sold->id)->is_active, 'seats with showtime inventory are deactivated, never deleted');
    }

    public function test_category_of_a_seat_with_inventory_cannot_change(): void
    {
        $show = Showtime::factory()->create();
        $room = ScreeningRoom::find($show->room_id);
        $seat = Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $this->standardCategory()->id, 'row_label' => 'A', 'number' => 1]);
        ShowtimeSeat::factory()->create(['showtime_id' => $show->id, 'seat_id' => $seat->id, 'status' => 'sold']);

        $this->as($this->staff(Role::SuperAdmin))->putJson("/api/v1/admin/rooms/{$room->public_id}/seats", [
            'seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'premium']],
        ])->assertStatus(422);
        $this->assertSame($this->standardCategory()->id, $seat->fresh()->seat_category_id);
    }

    public function test_layout_is_atomic_when_one_row_is_invalid(): void
    {
        $room = ScreeningRoom::factory()->create();
        Seat::factory()->create(['room_id' => $room->id, 'seat_category_id' => $this->standardCategory()->id, 'row_label' => 'A', 'number' => 1]);

        $this->as($this->staff(Role::SuperAdmin))->putJson("/api/v1/admin/rooms/{$room->public_id}/seats", [
            'seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'standard'], ['row_label' => 'B', 'number' => 1, 'category_key' => 'bogus']],
        ])->assertStatus(422);

        $this->assertSame(1, $room->seats()->count());
    }
}
