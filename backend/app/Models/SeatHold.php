<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeatHold extends Model
{
    protected $fillable = ['booking_id', 'showtime_seat_id', 'expires_at', 'released_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function showtimeSeat(): BelongsTo
    {
        return $this->belongsTo(ShowtimeSeat::class, 'showtime_seat_id');
    }
}
