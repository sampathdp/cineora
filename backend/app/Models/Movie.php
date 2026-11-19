<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Movie extends Model
{
    use HasFactory, HasPublicId, SoftDeletes;

    protected $fillable = ['slug', 'title', 'tagline', 'description', 'duration_min', 'release_date', 'age_rating', 'original_language', 'poster_path', 'banner_path', 'trailer_url', 'rating', 'screening_status', 'is_featured', 'seo_title', 'seo_description', 'art_theme'];

    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'is_featured' => 'boolean',
            'art_theme' => 'array',
            'published_at' => 'datetime',
            'status' => \App\Enums\MovieStatus::class,
            'screening_status' => \App\Enums\ScreeningStatus::class,
            'rating' => 'decimal:1',
        ];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class, 'movie_genres', 'movie_id', 'genre_id');
    }

    public function cast(): HasMany
    {
        return $this->hasMany(MovieCast::class);
    }

    public function crew(): HasMany
    {
        return $this->hasMany(MovieCrew::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(MovieImage::class);
    }

    public function trailers(): HasMany
    {
        return $this->hasMany(MovieTrailer::class);
    }

    public function languages(): HasMany
    {
        return $this->hasMany(MovieLanguage::class);
    }

    public function showtimes(): HasMany
    {
        return $this->hasMany(Showtime::class);
    }
}
