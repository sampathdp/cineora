<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieCast extends Model
{
    protected $table = 'movie_cast';

    public $timestamps = false;

    protected $fillable = ['movie_id', 'person_name', 'character_name', 'sort_order'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
