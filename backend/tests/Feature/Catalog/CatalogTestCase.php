<?php

namespace Tests\Feature\Catalog;

use App\Enums\MovieStatus;
use App\Models\Genre;
use App\Models\Movie;
use App\Models\SeatCategory;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Auth\AuthTestCase;

abstract class CatalogTestCase extends AuthTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->seed(ReferenceDataSeeder::class);
    }

    protected function movie(array $attrs = []): Movie
    {
        $movie = Movie::factory()->create(array_merge(['description' => 'A film.', 'poster_path' => 'movies/posters/x.jpg'], $attrs));
        $movie->forceFill(['status' => $attrs['status'] ?? MovieStatus::Published])->save();

        return $movie;
    }

    protected function genre(string $slug): Genre
    {
        return Genre::where('slug', $slug)->firstOrFail();
    }

    protected function standardCategory(): SeatCategory
    {
        return SeatCategory::whereNull('cinema_id')->where('key', 'standard')->firstOrFail();
    }
}
