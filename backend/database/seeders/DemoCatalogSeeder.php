<?php

namespace Database\Seeders;

use App\Enums\MovieStatus;
use App\Models\Cinema;
use App\Models\Genre;
use App\Models\Movie;
use App\Models\SeatCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Local-development demo content, imported from the original frontend mock data
 * (database/seeders/data/catalog.json, produced by scripts/export-catalog.mjs).
 * Refuses to run outside local/testing environments. Idempotent by slug.
 */
class DemoCatalogSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoCatalogSeeder only runs in local/testing environments.');

            return;
        }

        $this->call(ReferenceDataSeeder::class);
        $data = json_decode((string) file_get_contents(__DIR__.'/data/catalog.json'), true, flags: JSON_THROW_ON_ERROR);
        $publicImages = base_path('../public');

        foreach ($data['movies'] as $m) {
            if (Movie::withTrashed()->where('slug', $m['slug'])->exists()) {
                continue;
            }
            $movie = new Movie([
                'slug' => $m['slug'], 'title' => $m['title'], 'tagline' => $m['tagline'], 'description' => $m['synopsis'],
                'duration_min' => $m['durationMin'], 'rating' => $m['rating'], 'age_rating' => $m['certificate'],
                'release_date' => now()->addDays($m['releaseOffsetDays'])->toDateString(),
                'screening_status' => $m['status'] === 'now-playing' ? 'now_playing' : 'coming_soon',
                'is_featured' => (bool) ($m['featured'] ?? false),
                'trailer_url' => $m['trailerUrl'] ?? null,
                'art_theme' => ['from' => $m['art']['from'], 'to' => $m['art']['to'], 'accent' => $m['art']['accent'], 'motif' => $m['art']['motif']],
            ]);
            $movie->poster_path = $this->copy($publicImages.($m['art']['image'] ?? ''), 'movies/posters');
            $movie->banner_path = $this->copy($publicImages.($m['art']['backdrop'] ?? ''), 'movies/banners');
            $movie->status = MovieStatus::Published;
            $movie->published_at = now();
            $movie->save();

            $movie->genres()->sync(array_map(
                fn (string $name) => Genre::firstOrCreate(['slug' => Str::slug($name)], ['name' => $name])->id,
                $m['genres'],
            ));
            foreach ($m['cast'] as $i => $c) {
                $movie->cast()->create(['person_name' => $c['name'], 'character_name' => $c['role'], 'sort_order' => $i]);
            }
            $movie->crew()->create(['person_name' => $m['director'], 'job' => 'director', 'sort_order' => 0]);
            foreach ($m['writers'] as $i => $w) {
                $movie->crew()->create(['person_name' => $w, 'job' => 'writer', 'sort_order' => $i + 1]);
            }
        }

        foreach ($data['cinemas'] as $c) {
            if (Cinema::withTrashed()->where('slug', $c['slug'])->exists()) {
                continue;
            }
            $cinema = new Cinema([
                'slug' => $c['slug'], 'name' => $c['name'], 'area' => $c['area'], 'address' => $c['address'],
                'phone' => $c['phone'], 'email' => $c['email'], 'description' => $c['description'],
                'timezone' => config('cineora.timezone'), 'currency' => config('cineora.currency'), 'is_active' => true,
                'art_theme' => ['from' => $c['art']['from'], 'to' => $c['art']['to'], 'accent' => $c['art']['accent'], 'motif' => $c['art']['motif']],
            ]);
            $cinema->save();
            foreach ($c['facilities'] as $f) {
                $cinema->facilities()->create(['name' => $f]);
            }
            foreach ($c['screens'] as $screen) {
                $room = $cinema->rooms()->create(['name' => $screen['name'], 'screen_type' => $screen['type'], 'is_active' => true]);
                $this->seedGrid($room, $screen['rows'], $screen['seatsPerRow']);
            }
        }

        $this->seedShowtimes();
        $this->call(DemoContentSeeder::class);
    }

    /** Mirrors the original mock schedule: five slots a day for the next week, rotating through the now-playing titles. */
    private function seedShowtimes(): void
    {
        $service = app(\App\Services\Showtime\ShowtimeService::class);
        $movies = Movie::where('screening_status', 'now_playing')->orderBy('id')->get();
        $room = \App\Models\ScreeningRoom::orderBy('id')->first();
        if ($movies->isEmpty() || ! $room || $room->showtimes()->exists()) {
            return;
        }

        $tz = config('cineora.timezone');
        $times = ['10:30', '13:15', '16:00', '18:45', '21:30'];
        $prices = [['category_key' => 'standard', 'price' => 12000], ['category_key' => 'premium', 'price' => 16000], ['category_key' => 'lounge', 'price' => 22000]];

        for ($day = 0; $day < 7; $day++) {
            foreach ($times as $slot => $time) {
                $movie = $movies[($day * count($times) + $slot) % $movies->count()];
                try {
                    $showtime = $service->create([
                        'movie_id' => $movie->id, 'room_id' => $room->id, 'prices' => $prices,
                        'starts_at' => Carbon::now($tz)->addDays($day)->setTimeFromTimeString($time)->toIso8601String(),
                    ], null);
                    $service->publish($showtime, null);
                } catch (ValidationException) {
                    // Slots already in the past (today) or clashing with a long film are simply skipped.
                }
            }
        }
    }

    /** Same row-to-category rule the original frontend used. */
    private function seedGrid($room, int $rows, int $perRow): void
    {
        $cats = SeatCategory::whereNull('cinema_id')->pluck('id', 'key');
        for ($r = 0; $r < $rows; $r++) {
            $key = $r === $rows - 1 ? 'lounge' : ($r >= intdiv($rows, 3) && $r < $rows - 2 ? 'premium' : 'standard');
            for ($n = 1; $n <= $perRow; $n++) {
                $room->seats()->create(['row_label' => chr(65 + $r), 'number' => $n, 'seat_category_id' => $cats[$key], 'x' => $n, 'y' => $r, 'is_active' => true]);
            }
        }
    }

    private function copy(string $source, string $dir): ?string
    {
        if (! is_file($source)) {
            return null;
        }
        $name = $dir.'/'.Str::lower((string) Str::ulid()).'.'.pathinfo($source, PATHINFO_EXTENSION);
        Storage::disk(config('uploads.image.disk'))->put($name, (string) file_get_contents($source));

        return $name;
    }
}
