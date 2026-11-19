<?php

namespace Tests\Feature\Catalog;

use App\Enums\MovieStatus;
use App\Models\Cinema;
use App\Models\ScreeningRoom;
use App\Models\Seat;

class PublicCatalogTest extends CatalogTestCase
{
    public function test_only_published_movies_are_listed_and_no_editorial_fields_leak(): void
    {
        $this->movie(['title' => 'Visible']);
        $this->movie(['title' => 'Hidden Draft', 'status' => MovieStatus::Draft]);
        $this->movie(['title' => 'Old', 'status' => MovieStatus::Archived]);

        $r = $this->getJson('/api/v1/movies')->assertOk();

        $this->assertSame(['Visible'], collect($r->json('data'))->pluck('title')->all());
        $this->assertArrayNotHasKey('status', $r->json('data.0'));
        $this->assertArrayNotHasKey('created_at', $r->json('data.0'));
        $this->assertSame(1, $r->json('meta.total'));
    }

    public function test_draft_archived_and_deleted_movies_are_404_on_the_public_detail_route(): void
    {
        $draft = $this->movie(['status' => MovieStatus::Draft]);
        $archived = $this->movie(['status' => MovieStatus::Archived]);
        $deleted = $this->movie();
        $deleted->delete();
        $live = $this->movie();

        $this->getJson("/api/v1/movies/{$draft->slug}")->assertNotFound();
        $this->getJson("/api/v1/movies/{$archived->slug}")->assertNotFound();
        $this->getJson("/api/v1/movies/{$deleted->slug}")->assertNotFound();
        $this->getJson("/api/v1/movies/{$live->slug}")->assertOk()->assertJsonPath('data.slug', $live->slug);
    }

    public function test_filters_search_sort_and_pagination(): void
    {
        $a = $this->movie(['title' => 'Alpha Run', 'screening_status' => 'now_playing', 'is_featured' => true, 'release_date' => '2026-01-01']);
        $b = $this->movie(['title' => 'Beta Soon', 'screening_status' => 'coming_soon', 'release_date' => '2026-12-01']);
        $a->genres()->attach($this->genre('action'));
        $b->genres()->attach($this->genre('drama'));

        $titles = fn (string $qs) => collect($this->getJson('/api/v1/movies?'.$qs)->assertOk()->json('data'))->pluck('title')->all();

        $this->assertSame(['Alpha Run'], $titles('screening_status=now_playing'));
        $this->assertSame(['Beta Soon'], $titles('genre=drama'));
        $this->assertSame(['Alpha Run'], $titles('featured=1'));
        $this->assertSame(['Beta Soon'], $titles('q=soon'));
        $this->assertSame(['Beta Soon', 'Alpha Run'], $titles('sort=-release_date'));
        $this->assertSame(['Alpha Run', 'Beta Soon'], $titles('sort=title'));
        $this->assertSame(1, count($this->getJson('/api/v1/movies?per_page=1')->json('data')));
        $this->getJson('/api/v1/movies?per_page=5000')->assertStatus(422);
        $this->getJson('/api/v1/movies?sort=password')->assertStatus(422);
    }

    public function test_search_treats_like_wildcards_literally(): void
    {
        $this->movie(['title' => 'Plain Title']);
        $this->assertCount(0, $this->getJson('/api/v1/movies?q=%25')->json('data'));
    }

    public function test_genres_endpoint(): void
    {
        $this->getJson('/api/v1/genres')->assertOk()->assertJsonFragment(['slug' => 'sci-fi']);
    }

    public function test_cinemas_list_hides_inactive_cinemas_and_inactive_rooms(): void
    {
        $open = Cinema::factory()->create(['name' => 'Open Cinema']);
        Cinema::factory()->create(['name' => 'Closed Cinema', 'is_active' => false]);
        $room = ScreeningRoom::factory()->create(['cinema_id' => $open->id, 'name' => 'Hall 1']);
        ScreeningRoom::factory()->create(['cinema_id' => $open->id, 'name' => 'Old Hall', 'is_active' => false]);
        Seat::factory()->count(3)->create(['room_id' => $room->id, 'seat_category_id' => $this->standardCategory()->id]);

        $r = $this->getJson('/api/v1/cinemas')->assertOk();

        $this->assertSame(['Open Cinema'], collect($r->json('data'))->pluck('name')->all());
        $this->assertSame(['Hall 1'], collect($r->json('data.0.rooms'))->pluck('name')->all());
        $this->assertSame(3, $r->json('data.0.rooms.0.seat_count'));
        $this->assertArrayNotHasKey('is_active', $r->json('data.0'));
        $this->getJson('/api/v1/cinemas/'.Cinema::where('name', 'Closed Cinema')->value('slug'))->assertNotFound();
        $this->getJson('/api/v1/cinemas/'.$open->slug)->assertOk();
    }

    public function test_public_responses_never_expose_numeric_ids_or_storage_internals(): void
    {
        $movie = $this->movie();
        $body = $this->getJson('/api/v1/movies/'.$movie->slug)->assertOk()->json('data');

        $this->assertSame($movie->public_id, $body['id']);
        $this->assertArrayNotHasKey('poster_path', $body);
        $this->assertStringEndsWith('/storage/movies/posters/x.jpg', $body['poster_url']);
    }
}
