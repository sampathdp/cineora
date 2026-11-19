<?php

namespace Database\Seeders;

use App\Models\Genre;
use App\Models\SeatCategory;
use Illuminate\Database\Seeder;

/** Non-sensitive lookup data. Idempotent. */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['standard' => ['Standard', 12000], 'premium' => ['Premium', 16000], 'lounge' => ['Lounge', 22000]] as $key => [$name, $price]) {
            SeatCategory::firstOrCreate(['cinema_id' => null, 'key' => $key], ['name' => $name, 'default_price' => $price]);
        }

        foreach (['Action', 'Drama', 'Comedy', 'Animation', 'Thriller', 'Adventure', 'Mystery', 'Romance', 'Sci-Fi', 'Family'] as $name) {
            Genre::firstOrCreate(['slug' => str($name)->slug()->toString()], ['name' => $name]);
        }
    }
}
