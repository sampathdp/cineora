<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = ['booking_id', 'payment_reference', 'bank_account_id', 'expected_amount', 'submitted_amount', 'transfer_date', 'payer_name', 'submitted_by', 'submitted_at'];

    protected function casts(): array
    {
        return [
            'expected_amount' => 'decimal:2',
            'submitted_amount' => 'decimal:2',
            'transfer_date' => 'date',
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'exception_at' => 'datetime',
            'status' => \App\Enums\PaymentStatus::class,
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function proofs(): HasMany
    {
        return $this->hasMany(PaymentProof::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(PaymentReview::class);
    }
}
