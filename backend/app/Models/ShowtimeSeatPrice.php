<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShowtimeSeatPrice extends Model
{
    protected $fillable = ['showtime_id', 'seat_category_id', 'price'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
        ];
    }

    public function showtime(): BelongsTo
    {
        return $this->belongsTo(Showtime::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SeatCategory::class, 'seat_category_id');
    }
}
