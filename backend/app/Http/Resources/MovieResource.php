<?php

namespace App\Http\Resources;

use App\Services\Media\SecureUploadService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Movie */
class MovieResource extends JsonResource
{
    /** Admin variants extend this class and return true to include editorial/internal fields. */
    protected function isAdmin(): bool
    {
        return false;
    }

    public function toArray(Request $request): array
    {
        $uploads = app(SecureUploadService::class);
        $admin = $this->isAdmin();

        return [
            'id' => $this->public_id,
            'slug' => $this->slug,
            'title' => $this->title,
            'tagline' => $this->tagline,
            'description' => $this->description,
            'duration_min' => $this->duration_min,
            'release_date' => $this->release_date?->toDateString(),
            'age_rating' => $this->age_rating,
            'original_language' => $this->original_language,
            'rating' => $this->rating !== null ? (float) $this->rating : null,
            'screening_status' => $this->screening_status?->value,
            'is_featured' => $this->is_featured,
            'poster_url' => $uploads->url($this->poster_path),
            'banner_url' => $uploads->url($this->banner_path),
            'trailer_url' => $this->trailer_url,
            'art_theme' => $this->art_theme,
            'genres' => $this->whenLoaded('genres', fn () => $this->genres->map(fn ($g) => ['slug' => $g->slug, 'name' => $g->name])->values()),
            'cast' => $this->whenLoaded('cast', fn () => $this->cast->sortBy('sort_order')->map(fn ($c) => ['name' => $c->person_name, 'role' => $c->character_name])->values()),
            'crew' => $this->whenLoaded('crew', fn () => $this->crew->sortBy('sort_order')->map(fn ($c) => ['name' => $c->person_name, 'job' => $c->job])->values()),
            'languages' => $this->whenLoaded('languages', fn () => $this->languages->map(fn ($l) => ['code' => $l->language_code, 'kind' => $l->kind])->values()),
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            $this->mergeWhen($admin, fn () => [
                'status' => $this->status?->value,
                'published_at' => $this->published_at?->toIso8601String(),
                'created_at' => $this->created_at?->toIso8601String(),
                'updated_at' => $this->updated_at?->toIso8601String(),
            ]),
        ];
    }
}
