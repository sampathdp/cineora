<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Booking extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = ['reference', 'user_id', 'showtime_id', 'cinema_id', 'movie_id', 'subtotal', 'discount', 'fee', 'total', 'currency', 'promo_code_id', 'hold_expires_at', 'payment_deadline_at'];

    protected function casts(): array
    {
        return [
            'status' => \App\Enums\BookingStatus::class,
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'fee' => 'decimal:2',
            'total' => 'decimal:2',
            'hold_expires_at' => 'datetime',
            'payment_deadline_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function showtime(): BelongsTo
    {
        return $this->belongsTo(Showtime::class);
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(BookingSeat::class);
    }

    public function holds(): HasMany
    {
        return $this->hasMany(SeatHold::class);
    }

    public function histories(): HasMany
    {
        return $this->hasMany(BookingStatusHistory::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(BookingEvent::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function refundRequests(): HasMany
    {
        return $this->hasMany(RefundRequest::class);
    }
}
