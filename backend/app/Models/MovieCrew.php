<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieCrew extends Model
{
    protected $table = 'movie_crew';

    public $timestamps = false;

    protected $fillable = ['movie_id', 'person_name', 'job', 'sort_order'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
