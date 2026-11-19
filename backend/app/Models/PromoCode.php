<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PromoCode extends Model
{
    protected $fillable = ['code', 'type', 'value', 'min_amount', 'max_discount', 'starts_at', 'ends_at', 'usage_limit', 'per_user_limit', 'is_active'];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'min_amount' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'type' => \App\Enums\PromoType::class,
        ];
    }

    public function movies(): BelongsToMany
    {
        return $this->belongsToMany(Movie::class, 'promo_code_movies', 'promo_code_id', 'movie_id');
    }

    public function cinemas(): BelongsToMany
    {
        return $this->belongsToMany(Cinema::class, 'promo_code_cinemas', 'promo_code_id', 'cinema_id');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(PromoRedemption::class);
    }
}
