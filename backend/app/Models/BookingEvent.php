<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingEvent extends Model
{
    public $timestamps = false;

    protected $fillable = ['booking_id', 'type', 'payload'];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
