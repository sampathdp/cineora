<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CinemaFacility extends Model
{
    public $timestamps = false;

    protected $fillable = ['cinema_id', 'name'];

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }
}
