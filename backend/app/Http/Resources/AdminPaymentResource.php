<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Payment */
class AdminPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $booking = $this->booking;
        // Customer identity only for staff who hold the dedicated permission (a payment verifier normally does not).
        $customer = $viewer instanceof User && $viewer->canAt(\App\Enums\Permission::BookingsViewCustomer, $booking->cinema_id)
            ? ['name' => $booking->user->name, 'email' => $booking->user->email] : null;

        return [
            'id' => $this->public_id,
            'status' => $this->status->value,
            'payment_reference' => $this->payment_reference,
            'expected_amount' => (int) $this->expected_amount,
            'submitted_amount' => $this->submitted_amount !== null ? (int) $this->submitted_amount : null,
            'amount_matches' => $this->submitted_amount !== null && (int) $this->submitted_amount === (int) $this->expected_amount,
            'transfer_date' => $this->transfer_date?->toDateString(),
            'payer_name' => $this->payer_name,
            'submitted_at' => $this->submitted_at?->copy()->utc()->toIso8601String(),
            'verified_at' => $this->verified_at?->copy()->utc()->toIso8601String(),
            'exception_at' => $this->exception_at?->copy()->utc()->toIso8601String(),
            'currency' => $booking->currency,
            'booking' => [
                'id' => $booking->public_id, 'reference' => $booking->reference, 'status' => $booking->status->value,
                'seats' => $booking->seats->pluck('seat_label')->sort(SORT_NATURAL)->values(),
                'payment_deadline_at' => $booking->payment_deadline_at->copy()->utc()->toIso8601String(),
                'movie' => $booking->showtime?->movie?->title, 'cinema' => $booking->showtime?->cinema?->name,
                'starts_at' => $booking->showtime?->starts_at?->copy()->utc()->toIso8601String(),
            ],
            'customer' => $customer,
            'bank_account' => $this->bankAccount ? ['bank_name' => $this->bankAccount->bank_name, 'account_name' => $this->bankAccount->account_name] : null,
            'proofs' => $this->proofs->map(fn ($p) => ['id' => $p->id, 'mime' => $p->mime, 'size' => $p->size, 'uploaded_at' => $p->created_at?->copy()->utc()->toIso8601String()])->values(),
            'reviews' => $this->reviews->sortBy('id')->map(fn ($r) => [
                'decision' => $r->decision->value, 'reason' => $r->reason, 'notes' => $r->internal_notes,
                'reviewer' => $r->reviewer?->name, 'at' => $r->created_at?->copy()->utc()->toIso8601String(),
            ])->values(),
        ];
    }
}
