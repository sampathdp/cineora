<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundTransaction extends Model
{
    protected $fillable = ['refund_request_id', 'amount', 'reference', 'paid_at', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function refundRequest(): BelongsTo
    {
        return $this->belongsTo(RefundRequest::class, 'refund_request_id');
    }
}
