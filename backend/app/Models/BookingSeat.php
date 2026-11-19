<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BookingSeat extends Model
{
    use HasFactory;

    protected $fillable = ['booking_id', 'showtime_id', 'showtime_seat_id', 'seat_id', 'seat_label', 'category_name', 'unit_price', 'released_at'];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
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

    public function seat(): BelongsTo
    {
        return $this->belongsTo(Seat::class);
    }

    public function ticket(): HasOne
    {
        return $this->hasOne(Ticket::class);
    }
}
