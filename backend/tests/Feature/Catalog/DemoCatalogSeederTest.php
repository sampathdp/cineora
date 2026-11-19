<?php

namespace Tests\Feature\Catalog;

use App\Models\Cinema;
use App\Models\Movie;
use App\Models\Seat;
use Database\Seeders\DemoCatalogSeeder;

class DemoCatalogSeederTest extends CatalogTestCase
{
    public function test_demo_seeder_imports_the_mock_catalogue_idempotently_and_it_is_served_publicly(): void
    {
        $this->seed(DemoCatalogSeeder::class);
        $this->seed(DemoCatalogSeeder::class); // second run must not duplicate

        $this->assertSame(14, Movie::count());
        $this->assertSame(1, Cinema::count());
        $this->assertSame(140, Seat::count());
        $this->assertSame(['standard', 'premium', 'lounge'], Seat::with('category')->orderBy('id')->get()->pluck('category.key')->unique()->values()->all());

        $r = $this->getJson('/api/v1/movies?per_page=100')->assertOk();
        $this->assertCount(14, $r->json('data'));
        $first = $this->getJson('/api/v1/movies/ashes-of-the-lantern')->assertOk()->json('data');
        $this->assertSame(['Thriller', 'Mystery'], array_column($first['genres'], 'name'));
        $this->assertNotEmpty($first['poster_url']);
    }

    public function test_demo_seeder_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';
        (new DemoCatalogSeeder)->run(); // direct call: no console output object in this context

        $this->assertSame(0, Movie::count());
    }
}
