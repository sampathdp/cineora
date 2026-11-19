<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ScreeningRoom extends Model
{
    use HasFactory, HasPublicId, SoftDeletes;

    protected $fillable = ['cinema_id', 'name', 'screen_type', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(Seat::class, 'room_id');
    }

    public function showtimes(): HasMany
    {
        return $this->hasMany(Showtime::class, 'room_id');
    }
}
