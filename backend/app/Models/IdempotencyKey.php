<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyKey extends Model
{
    protected $fillable = ['user_id', 'key', 'request_hash', 'resource_type', 'resource_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
