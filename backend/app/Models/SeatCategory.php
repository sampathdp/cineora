<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SeatCategory extends Model
{
    use HasFactory;

    protected $fillable = ['cinema_id', 'key', 'name', 'default_price'];

    protected function casts(): array
    {
        return [
            'default_price' => 'decimal:2',
        ];
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(Seat::class);
    }
}
