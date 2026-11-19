<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieTrailer extends Model
{
    public $timestamps = false;

    protected $fillable = ['movie_id', 'url', 'title', 'sort_order'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
