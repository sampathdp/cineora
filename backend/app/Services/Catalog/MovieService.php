<?php

namespace App\Services\Catalog;

use App\Enums\MovieStatus;
use App\Models\Genre;
use App\Models\Movie;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Media\SecureUploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MovieService
{
    public const IMAGE_DIRS = ['movies/posters', 'movies/banners', 'movies/stills'];

    private const SCALARS = [
        'title', 'tagline', 'description', 'duration_min', 'release_date', 'age_rating', 'original_language',
        'trailer_url', 'rating', 'screening_status', 'is_featured', 'seo_title', 'seo_description', 'art_theme',
    ];

    public function __construct(private readonly AuditLogger $audit, private readonly SecureUploadService $uploads) {}

    /** Creates or updates a movie. `status` is never taken from input: use publish()/unpublish()/archive(). */
    public function save(array $data, User $actor, ?Movie $movie = null): Movie
    {
        return DB::transaction(function () use ($data, $actor, $movie) {
            $creating = $movie === null;
            if ($creating) {
                $movie = new Movie;
                $movie->status = MovieStatus::Draft;
            }
            $movie->fill(array_intersect_key($data, array_flip(self::SCALARS)));

            if ($creating || isset($data['slug'])) {
                $movie->slug = $this->uniqueSlug($data['slug'] ?? $movie->title, $movie->exists ? $movie->id : null);
            }
            $movie->save();

            if (array_key_exists('genres', $data)) {
                $movie->genres()->sync(Genre::whereIn('slug', $data['genres'] ?? [])->pluck('id'));
            }
            if (array_key_exists('cast', $data)) {
                $movie->cast()->delete();
                foreach (array_values($data['cast'] ?? []) as $i => $c) {
                    $movie->cast()->create(['person_name' => $c['name'], 'character_name' => $c['role'] ?? null, 'sort_order' => $i]);
                }
            }
            if (array_key_exists('crew', $data)) {
                $movie->crew()->delete();
                foreach (array_values($data['crew'] ?? []) as $i => $c) {
                    $movie->crew()->create(['person_name' => $c['name'], 'job' => $c['job'], 'sort_order' => $i]);
                }
            }
            if (array_key_exists('languages', $data)) {
                $movie->languages()->delete();
                foreach ($data['languages'] ?? [] as $l) {
                    $movie->languages()->create(['language_code' => $l['code'], 'kind' => $l['kind']]);
                }
            }

            $this->audit->log($creating ? 'movie.created' : 'movie.updated', $actor, 'movie', $movie->public_id, ['fields' => array_keys($data)]);

            return $movie->load($this->relations());
        });
    }

    public function publish(Movie $movie, User $actor): Movie
    {
        $missing = [];
        if (! $movie->poster_path) {
            $missing['poster'] = ['Upload a poster before publishing.'];
        }
        if (! $movie->description) {
            $missing['description'] = ['Add a synopsis before publishing.'];
        }
        if ($missing) {
            throw ValidationException::withMessages($missing);
        }

        return $this->transition($movie, $actor, MovieStatus::Published, 'movie.published');
    }

    public function unpublish(Movie $movie, User $actor): Movie
    {
        return $this->transition($movie, $actor, MovieStatus::Draft, 'movie.unpublished');
    }

    public function archive(Movie $movie, User $actor): Movie
    {
        return $this->transition($movie, $actor, MovieStatus::Archived, 'movie.archived');
    }

    public function uploadImage(Movie $movie, string $kind, UploadedFile $file, User $actor): Movie
    {
        $dir = match ($kind) {
            'poster' => 'movies/posters',
            'banner' => 'movies/banners',
        };
        $column = $kind.'_path';

        $new = $this->uploads->storeImage($file, $dir);
        $old = $movie->{$column};
        $movie->forceFill([$column => $new])->save();
        $this->uploads->delete($old, self::IMAGE_DIRS);
        $this->audit->log('movie.image_uploaded', $actor, 'movie', $movie->public_id, ['kind' => $kind]);

        return $movie->load($this->relations());
    }

    public function relations(): array
    {
        return ['genres', 'cast', 'crew', 'languages'];
    }

    private function transition(Movie $movie, User $actor, MovieStatus $to, string $action): Movie
    {
        $from = $movie->status;
        $movie->forceFill([
            'status' => $to,
            'published_at' => $to === MovieStatus::Published ? ($movie->published_at ?? now()) : $movie->published_at,
        ])->save();
        $this->audit->log($action, $actor, 'movie', $movie->public_id, ['from' => $from?->value, 'to' => $to->value]);

        return $movie->load($this->relations());
    }

    private function uniqueSlug(string $source, ?int $ignoreId): string
    {
        $base = Str::slug($source) ?: 'movie';
        $slug = $base;
        $i = 2;
        while (Movie::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
