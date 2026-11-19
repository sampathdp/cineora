<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Showtime extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = ['movie_id', 'cinema_id', 'room_id', 'starts_at', 'ends_at', 'sales_cutoff_minutes', 'created_by'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'status' => \App\Enums\ShowtimeStatus::class,
        ];
    }

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(ScreeningRoom::class, 'room_id');
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ShowtimeSeatPrice::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(ShowtimeSeat::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** Seats can be sold: published for sale and the cut-off before the start has not passed. */
    public function isBookable(): bool
    {
        return $this->status === \App\Enums\ShowtimeStatus::OnSale
            && now()->lt($this->starts_at->copy()->subMinutes($this->sales_cutoff_minutes));
    }

    public function salesClosesAt(): \Illuminate\Support\Carbon
    {
        return $this->starts_at->copy()->subMinutes($this->sales_cutoff_minutes);
    }
}
