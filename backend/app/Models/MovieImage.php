<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieImage extends Model
{
    protected $fillable = ['movie_id', 'path', 'kind', 'alt', 'sort_order'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
