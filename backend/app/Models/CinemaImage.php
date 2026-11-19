<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CinemaImage extends Model
{
    protected $fillable = ['cinema_id', 'path', 'alt', 'sort_order'];

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }
}
