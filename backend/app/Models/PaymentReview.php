<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentReview extends Model
{
    public $timestamps = false;

    protected $fillable = ['payment_id', 'reviewer_id', 'decision', 'reason', 'internal_notes'];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'decision' => \App\Enums\ReviewDecision::class,
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
