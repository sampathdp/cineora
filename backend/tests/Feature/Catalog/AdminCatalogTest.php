<?php

namespace Tests\Feature\Catalog;

use App\Enums\MovieStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Cinema;
use App\Models\Movie;
use App\Models\ScreeningRoom;
use App\Models\Showtime;

class AdminCatalogTest extends CatalogTestCase
{
    private function validMovie(array $over = []): array
    {
        return array_merge(['title' => 'New Film', 'duration_min' => 120, 'description' => 'Plot.'], $over);
    }

    public function test_admin_routes_reject_anonymous_customers_and_wrong_roles(): void
    {
        $movie = $this->movie();
        $this->getJson('/api/v1/admin/movies')->assertUnauthorized();

        $this->as($this->customer())->getJson('/api/v1/admin/movies')->assertForbidden();
        $this->as($this->staff(Role::TicketChecker))->getJson('/api/v1/admin/movies')->assertForbidden();
        $this->as($this->staff(Role::PaymentVerifier))->postJson('/api/v1/admin/movies', $this->validMovie())->assertForbidden();
        // Cinema managers can look at movies but not edit them.
        $manager = $this->staff(Role::CinemaManager);
        $this->as($manager)->getJson('/api/v1/admin/movies')->assertOk();
        $this->postJson('/api/v1/admin/movies', $this->validMovie())->assertForbidden();
        $this->patchJson("/api/v1/admin/movies/{$movie->public_id}", ['title' => 'x'])->assertForbidden();
    }

    public function test_content_manager_creates_a_draft_and_cannot_force_status_or_paths(): void
    {
        $cm = $this->staff(Role::ContentManager);

        $r = $this->as($cm)->postJson('/api/v1/admin/movies', $this->validMovie([
            'status' => 'published', 'published_at' => '2020-01-01', 'poster_path' => '../../etc/passwd', 'slug' => 'my-film',
            'genres' => ['action', 'drama'], 'cast' => [['name' => 'A Actor', 'role' => 'Hero']], 'crew' => [['name' => 'D Director', 'job' => 'director']],
        ]))->assertCreated();

        $movie = Movie::where('public_id', $r->json('data.id'))->firstOrFail();
        $this->assertSame(MovieStatus::Draft, $movie->status);
        $this->assertNull($movie->published_at);
        $this->assertNull($movie->poster_path);
        $this->assertSame('my-film', $movie->slug);
        $this->assertSame(['action', 'drama'], $r->json('data.genres.*.slug'));
        $this->assertSame('Hero', $r->json('data.cast.0.role'));
        $this->assertSame(1, AuditLog::where('action', 'movie.created')->where('actor_id', $cm->id)->count());
    }

    public function test_slugs_are_unique_and_validation_is_enforced(): void
    {
        $cm = $this->staff(Role::ContentManager);
        $this->as($cm)->postJson('/api/v1/admin/movies', $this->validMovie(['title' => 'Same Name']))->assertCreated();
        $second = $this->postJson('/api/v1/admin/movies', $this->validMovie(['title' => 'Same Name']))->assertCreated();
        $this->assertSame('same-name-2', Movie::where('public_id', $second->json('data.id'))->value('slug'));

        $this->postJson('/api/v1/admin/movies', $this->validMovie(['duration_min' => 0]))->assertStatus(422);
        $this->postJson('/api/v1/admin/movies', $this->validMovie(['trailer_url' => 'https://evil.test/watch']))->assertStatus(422)->assertJsonValidationErrors('trailer_url');
        $this->postJson('/api/v1/admin/movies', $this->validMovie(['trailer_url' => 'javascript:alert(1)']))->assertStatus(422);
        $this->postJson('/api/v1/admin/movies', $this->validMovie(['trailer_url' => 'https://www.youtube.com/watch?v=abc']))->assertCreated();
        $this->postJson('/api/v1/admin/movies', $this->validMovie(['genres' => ['nonsense']]))->assertStatus(422);
        $this->postJson('/api/v1/admin/movies', $this->validMovie(['art_theme' => ['from' => 'red', 'to' => '#000000', 'accent' => '#ffffff', 'motif' => 'moon']]))->assertStatus(422);
        $this->postJson('/api/v1/admin/movies', ['duration_min' => 90])->assertStatus(422)->assertJsonValidationErrors('title');
    }

    public function test_publish_lifecycle_requires_poster_and_the_publish_permission(): void
    {
        $cm = $this->staff(Role::ContentManager);
        $draft = $this->movie(['status' => MovieStatus::Draft, 'poster_path' => null]);

        $this->as($cm)->postJson("/api/v1/admin/movies/{$draft->public_id}/publish")->assertStatus(422)->assertJsonValidationErrors('poster');

        $draft->update(['poster_path' => 'movies/posters/x.jpg']);
        $this->postJson("/api/v1/admin/movies/{$draft->public_id}/publish")->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson("/api/v1/movies/{$draft->slug}")->assertOk();

        $this->postJson("/api/v1/admin/movies/{$draft->public_id}/unpublish")->assertOk();
        $this->getJson("/api/v1/movies/{$draft->slug}")->assertNotFound();

        $this->postJson("/api/v1/admin/movies/{$draft->public_id}/archive")->assertOk()->assertJsonPath('data.status', 'archived');
        $this->assertSame(['movie.published', 'movie.unpublished', 'movie.archived'], AuditLog::whereIn('action', ['movie.published', 'movie.unpublished', 'movie.archived'])->orderBy('id')->pluck('action')->all());

        // A role with edit-but-not-publish rights cannot publish.
        $editor = \App\Models\User::factory()->create();
        $role = \App\Models\AccessRole::create(['key' => 'editor_only', 'name' => 'Editor']);
        $role->permissions()->sync(\App\Models\AccessPermission::whereIn('key', ['movies.view', 'movies.manage'])->pluck('id'));
        $editor->roles()->attach($role->id);
        $other = $this->movie(['status' => MovieStatus::Draft]);
        $this->as($editor)->postJson("/api/v1/admin/movies/{$other->public_id}/publish")->assertForbidden();
        $this->assertSame(MovieStatus::Draft, $other->fresh()->status);
    }

    public function test_movies_with_showtimes_cannot_be_deleted_but_others_can(): void
    {
        $cm = $this->staff(Role::ContentManager);
        $scheduled = $this->movie();
        Showtime::factory()->create(['movie_id' => $scheduled->id]);
        $free = $this->movie();

        $this->as($cm)->deleteJson("/api/v1/admin/movies/{$scheduled->public_id}")->assertStatus(409)->assertJson(['code' => 'has_showtimes']);
        $this->deleteJson("/api/v1/admin/movies/{$free->public_id}")->assertOk();
        $this->assertSoftDeleted($free);
    }

    public function test_admin_movie_endpoints_do_not_accept_numeric_ids(): void
    {
        $movie = $this->movie();
        $this->as($this->staff(Role::ContentManager))->getJson("/api/v1/admin/movies/{$movie->id}")->assertNotFound();
    }

    // --- Cinemas, rooms, scoping -------------------------------------------------

    public function test_cinema_manager_only_sees_and_edits_assigned_cinemas(): void
    {
        $mine = Cinema::factory()->create(['name' => 'Mine']);
        $other = Cinema::factory()->create(['name' => 'Other']);
        $manager = $this->staff(Role::CinemaManager);
        $manager->cinemas()->attach($mine);
        $manager->flushAccessCache();

        $r = $this->as($manager)->getJson('/api/v1/admin/cinemas')->assertOk();
        $this->assertSame(['Mine'], collect($r->json('data'))->pluck('name')->all());

        $this->getJson("/api/v1/admin/cinemas/{$mine->public_id}")->assertOk();
        $this->getJson("/api/v1/admin/cinemas/{$other->public_id}")->assertForbidden();
        $this->patchJson("/api/v1/admin/cinemas/{$mine->public_id}", ['description' => 'New'])->assertOk();
        $this->patchJson("/api/v1/admin/cinemas/{$other->public_id}", ['description' => 'Hacked'])->assertForbidden();
        $this->assertNotSame('Hacked', $other->fresh()->description);

        // Rooms and seat layouts are scoped the same way.
        $this->getJson("/api/v1/admin/cinemas/{$other->public_id}/rooms")->assertForbidden();
        $this->postJson("/api/v1/admin/cinemas/{$other->public_id}/rooms", ['name' => 'Sneaky'])->assertForbidden();
        $this->postJson("/api/v1/admin/cinemas/{$mine->public_id}/rooms", ['name' => 'Hall A', 'screen_type' => 'Standard'])->assertCreated();
        $foreignRoom = ScreeningRoom::factory()->create(['cinema_id' => $other->id]);
        $this->patchJson("/api/v1/admin/rooms/{$foreignRoom->public_id}", ['name' => 'Pwned'])->assertForbidden();
        $this->getJson("/api/v1/admin/rooms/{$foreignRoom->public_id}/seats")->assertForbidden();
        $this->putJson("/api/v1/admin/rooms/{$foreignRoom->public_id}/seats", ['seats' => [['row_label' => 'A', 'number' => 1, 'category_key' => 'standard']]])->assertForbidden();
        $this->deleteJson("/api/v1/admin/rooms/{$foreignRoom->public_id}")->assertForbidden();
    }

    public function test_only_super_admin_creates_cinemas_and_slug_is_immutable(): void
    {
        $payload = ['name' => 'Gangnam Cineora', 'address' => '1 Teheran-ro', 'facilities' => ['Parking', 'Parking', 'IMAX']];

        $this->as($this->staff(Role::CinemaManager))->postJson('/api/v1/admin/cinemas', $payload)->assertForbidden();

        $r = $this->as($this->staff(Role::SuperAdmin))->postJson('/api/v1/admin/cinemas', $payload)->assertCreated();
        $this->assertSame('gangnam-cineora', $r->json('data.slug'));
        $this->assertSame(['Parking', 'IMAX'], $r->json('data.facilities'));
        $this->assertSame('KRW', $r->json('data.currency'));
        $this->assertSame('Asia/Seoul', $r->json('data.timezone'));

        $id = $r->json('data.id');
        $this->patchJson("/api/v1/admin/cinemas/{$id}", ['slug' => 'changed', 'name' => 'Renamed'])->assertOk();
        $this->assertSame('gangnam-cineora', Cinema::where('public_id', $id)->value('slug'));
        $this->postJson('/api/v1/admin/cinemas', ['name' => 'X', 'address' => 'Y', 'timezone' => 'Mars/Base'])->assertStatus(422);
    }

    public function test_room_with_showtimes_cannot_be_deleted(): void
    {
        $show = Showtime::factory()->create();
        $room = ScreeningRoom::find($show->room_id);

        $this->as($this->staff(Role::SuperAdmin))->deleteJson("/api/v1/admin/rooms/{$room->public_id}")->assertStatus(422);
        $this->assertNotSoftDeleted($room);

        $empty = ScreeningRoom::factory()->create();
        $this->deleteJson("/api/v1/admin/rooms/{$empty->public_id}")->assertOk();
    }
}
