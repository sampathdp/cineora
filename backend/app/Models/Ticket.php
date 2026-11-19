<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ticket extends Model
{
    use HasPublicId;

    protected $fillable = ['booking_id', 'booking_seat_id', 'showtime_id', 'token_hash', 'issued_at', 'used_at'];

    protected $hidden = ['token_hash', 'qr_token_encrypted'];

    protected function casts(): array
    {
        return [
            'status' => \App\Enums\TicketStatus::class,
            'qr_token_encrypted' => 'encrypted',
            'issued_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function bookingSeat(): BelongsTo
    {
        return $this->belongsTo(BookingSeat::class, 'booking_seat_id');
    }

    public function showtime(): BelongsTo
    {
        return $this->belongsTo(Showtime::class);
    }

    public function checkin(): HasOne
    {
        return $this->hasOne(TicketCheckin::class);
    }

    public function validationEvents(): HasMany
    {
        return $this->hasMany(TicketValidationEvent::class);
    }
}
