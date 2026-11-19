<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cinema extends Model
{
    use HasFactory, HasPublicId, SoftDeletes;

    protected $fillable = ['slug', 'name', 'area', 'address', 'phone', 'email', 'description', 'timezone', 'currency', 'is_active', 'art_theme'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'art_theme' => 'array',
        ];
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(ScreeningRoom::class);
    }

    public function facilities(): HasMany
    {
        return $this->hasMany(CinemaFacility::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(CinemaImage::class);
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'staff_cinema_assignments', 'cinema_id', 'user_id');
    }

    public function showtimes(): HasMany
    {
        return $this->hasMany(Showtime::class);
    }
}
