<?php

namespace App\Http\Resources;

use App\Enums\ReviewDecision;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Customer view of their own payment: instructions, status, and the reason if a proof was rejected.
 * Internal reviewer notes and reviewer identities are never included.
 *
 * @mixin \App\Models\Payment
 */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $booking = $this->booking;
        $account = $this->bankAccount;
        // The reason belongs to the booking, not to one payment row: after a rejection the customer works with a fresh row.
        $rejectionReason = $booking->status->value === 'PAYMENT_REJECTED'
            ? \App\Models\PaymentReview::whereIn('payment_id', $booking->payments()->select('id'))->where('decision', ReviewDecision::Rejected->value)->latest('id')->value('reason')
            : null;

        return [
            'id' => $this->public_id,
            'status' => $this->status->value,
            // The customer writes the booking reference in the transfer memo so staff can match the money.
            'transfer_memo' => $booking->reference,
            'expected_amount' => (int) $this->expected_amount,
            'submitted_amount' => $this->submitted_amount !== null ? (int) $this->submitted_amount : null,
            'transfer_date' => $this->transfer_date?->toDateString(),
            'currency' => $booking->currency,
            'bank' => [
                'bank_name' => $account->bank_name, 'account_name' => $account->account_name, 'account_number' => $account->account_number,
                'branch' => $account->branch, 'swift' => $account->swift, 'instructions' => $account->instructions,
            ],
            'rejection_reason' => $rejectionReason,
            'proofs' => $this->proofs->map(fn ($p) => ['id' => $p->id, 'mime' => $p->mime, 'size' => $p->size, 'uploaded_at' => $p->created_at?->copy()->utc()->toIso8601String()])->values(),
        ];
    }
}
