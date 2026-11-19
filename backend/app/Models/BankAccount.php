<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankAccount extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = ['cinema_id', 'bank_name', 'account_name', 'account_number', 'branch', 'swift', 'instructions', 'is_active'];

    protected function casts(): array
    {
        return [
            'account_number' => 'encrypted',
            'is_active' => 'boolean',
        ];
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }
}
