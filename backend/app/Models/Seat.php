<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Seat extends Model
{
    use HasFactory;

    protected $fillable = ['room_id', 'row_label', 'number', 'seat_category_id', 'x', 'y', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(ScreeningRoom::class, 'room_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SeatCategory::class, 'seat_category_id');
    }
}
