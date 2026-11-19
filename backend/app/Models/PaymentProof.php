<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentProof extends Model
{
    protected $fillable = ['payment_id', 'disk', 'path', 'original_name', 'mime', 'size', 'sha256', 'uploaded_by'];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
