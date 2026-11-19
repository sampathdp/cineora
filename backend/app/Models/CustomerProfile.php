<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerProfile extends Model
{
    protected $fillable = ['user_id', 'phone', 'date_of_birth', 'marketing_opt_in', 'locale'];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'marketing_opt_in' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
