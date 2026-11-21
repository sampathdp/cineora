<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankAccount extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = ['cinema_id', 'bank_name', 'account_name', 'account_number', 'branch', 'swift', 'instructions', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Stored encrypted. A value written under a different APP_KEY (e.g. a database copied from another environment)
     * cannot be decrypted; it reads as null instead of failing the whole request, and staff re-enter it in admin.
     */
    protected function accountNumber(): Attribute
    {
        return Attribute::make(
            get: function (?string $value) {
                if ($value === null) {
                    return null;
                }
                try {
                    return Crypt::decryptString($value);
                } catch (DecryptException) {
                    Log::warning('Bank account number cannot be decrypted with the current APP_KEY; re-enter it in admin.', ['bank_account_id' => $this->id]);

                    return null;
                }
            },
            set: fn (?string $value) => $value === null ? null : Crypt::encryptString($value),
        );
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }
}
