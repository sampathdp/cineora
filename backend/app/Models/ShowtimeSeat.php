<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShowtimeSeat extends Model
{
    use HasFactory;

    protected $fillable = ['showtime_id', 'seat_id', 'price', 'status', 'booking_id', 'hold_expires_at'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'hold_expires_at' => 'datetime',
            'status' => \App\Enums\ShowtimeSeatStatus::class,
        ];
    }

    public function showtime(): BelongsTo
    {
        return $this->belongsTo(Showtime::class);
    }

    public function seat(): BelongsTo
    {
        return $this->belongsTo(Seat::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
