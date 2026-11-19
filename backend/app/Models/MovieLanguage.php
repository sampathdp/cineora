<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieLanguage extends Model
{
    public $timestamps = false;

    protected $fillable = ['movie_id', 'language_code', 'kind'];

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
