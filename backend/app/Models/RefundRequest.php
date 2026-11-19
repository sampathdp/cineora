<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RefundRequest extends Model
{
    use HasPublicId;

    protected $fillable = ['booking_id', 'requested_by', 'reason', 'amount', 'decided_by', 'decided_at'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'decided_at' => 'datetime',
            'status' => \App\Enums\RefundStatus::class,
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(RefundTransaction::class);
    }
}
