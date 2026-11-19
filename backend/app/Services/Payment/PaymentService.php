<?php

namespace App\Services\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\ShowtimeStatus;
use App\Exceptions\DomainConflictException;
use App\Models\BankAccount;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentProof;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Booking\BookingStateMachine;
use App\Services\Media\SecureUploadService;
use App\Services\Notification\Outbox;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Customer side of the bank-transfer flow: payment instructions and proof submission. */
class PaymentService
{
    public function __construct(
        private readonly BookingStateMachine $machine,
        private readonly SecureUploadService $uploads,
        private readonly SeatProtection $protection,
        private readonly AuditLogger $audit,
    ) {}

    /** The payment that is still in play for a booking (rejected and expired ones are history). */
    public function livePayment(Booking $booking): ?Payment
    {
        return Payment::where('booking_id', $booking->id)->whereNotIn('status', [PaymentStatus::REJECTED->value, PaymentStatus::EXPIRED->value])->latest('id')->first();
    }

    /** Finds or creates the payment row for a booking, choosing the active bank account for its cinema. */
    public function ensurePayment(Booking $booking): Payment
    {
        if ($payment = $this->livePayment($booking)) {
            return $payment;
        }

        $account = BankAccount::query()->where('is_active', true)
            ->where(fn ($q) => $q->where('cinema_id', $booking->cinema_id)->orWhereNull('cinema_id'))
            ->orderByRaw('cinema_id IS NULL')->orderBy('id')->first();
        if (! $account) {
            throw new DomainConflictException('Bank transfer details are not available yet. Please contact the cinema.', 'payment_unavailable');
        }

        try {
            $payment = new Payment([
                'booking_id' => $booking->id, 'payment_reference' => 'PAY-'.strtoupper(bin2hex(random_bytes(5))),
                'bank_account_id' => $account->id, 'expected_amount' => (int) $booking->total,
            ]);
            $payment->status = PaymentStatus::AWAITING_TRANSFER;
            $payment->save();
        } catch (QueryException $e) {
            if (($e->errorInfo[1] ?? null) === 1062 && ($live = $this->livePayment($booking))) {
                return $live; // a concurrent request created it first
            }
            throw $e;
        }

        return $payment;
    }

    /**
     * @param  array{submitted_amount: int, transfer_date: string, payer_name?: string|null}  $data
     */
    public function submitProof(Booking $booking, User $customer, array $data, UploadedFile $file): Payment
    {
        return DB::transaction(function () use ($booking, $customer, $data, $file) {
            $locked = Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if ($locked->user_id !== $customer->id) {
                abort(404); // defence in depth: the controller already scopes by owner
            }

            match ($locked->status) {
                BookingStatus::PENDING_PAYMENT => $locked->hold_expires_at->lte(now())
                    ? throw new DomainConflictException('The seat hold for this booking has ended.', 'hold_expired') : null,
                BookingStatus::PAYMENT_REJECTED => $locked->payment_deadline_at->lte(now())
                    ? throw new DomainConflictException('The payment deadline for this booking has passed.', 'deadline_passed') : null,
                BookingStatus::PAYMENT_REVIEW => throw new DomainConflictException('Your payment proof is already being reviewed.', 'already_submitted'),
                default => throw new DomainConflictException('This booking cannot receive a payment.', 'not_payable'),
            };

            $showtime = $locked->showtime;
            if ($showtime->status !== ShowtimeStatus::OnSale || $showtime->starts_at->lte(now())) {
                throw new DomainConflictException('This showtime is no longer on sale.', 'showtime_closed');
            }
            if (! $this->protection->seatsIntact($locked)) {
                throw new DomainConflictException('Your seats are no longer reserved for this booking.', 'seats_lost');
            }

            $transfer = \Illuminate\Support\Carbon::parse($data['transfer_date'])->startOfDay();
            if ($transfer->gt(now()->addDay()) || $transfer->lt($locked->created_at->copy()->subDay()->startOfDay())) {
                throw ValidationException::withMessages(['transfer_date' => ['The transfer date must be between the booking date and today.']]);
            }

            $payment = $this->ensurePayment($locked);
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if (! in_array($payment->status, [PaymentStatus::AWAITING_TRANSFER], true)) {
                throw new DomainConflictException('A payment proof was already submitted for this booking.', 'already_submitted');
            }

            $stored = $this->uploads->storeProof($file, 'payment-proofs/'.now()->format('Y/m'));
            try {
                $duplicate = PaymentProof::where('sha256', $stored['sha256'])
                    ->whereHas('payment', fn ($q) => $q->where('booking_id', '!=', $locked->id))->exists();
                if ($duplicate) {
                    throw ValidationException::withMessages(['proof' => ['This file has already been used as proof for another booking.']]);
                }

                $payment->proofs()->create([
                    'disk' => $stored['disk'], 'path' => $stored['path'], 'original_name' => mb_substr(basename($file->getClientOriginalName()), 0, 120),
                    'mime' => $stored['mime'], 'size' => $stored['size'], 'sha256' => $stored['sha256'], 'uploaded_by' => $customer->id,
                ]);
                $payment->fill(['submitted_amount' => $data['submitted_amount'], 'transfer_date' => $data['transfer_date'], 'payer_name' => $data['payer_name'] ?? null, 'submitted_by' => $customer->id, 'submitted_at' => now()]);
                $payment->status = PaymentStatus::PROOF_SUBMITTED;
                $payment->save();

                // Review protects the seats, but only until the original payment deadline.
                $this->machine->transition($locked, BookingStatus::PAYMENT_REVIEW, $customer, 'payment proof submitted', function (Booking $b) {
                    $this->protection->protectUntil($b, $b->payment_deadline_at);
                });

                Outbox::publish('payment.proof_received', ['booking_id' => $locked->id]);
                $this->audit->log('payment.proof_submitted', $customer, 'payment', $payment->public_id, ['booking' => $locked->public_id, 'amount' => (int) $data['submitted_amount'], 'mime' => $stored['mime']]);
            } catch (\Throwable $e) {
                $this->uploads->delete($stored['path'], ['payment-proofs'], $stored['disk']); // do not leave orphan files behind
                throw $e;
            }

            return $payment->load('proofs');
        });
    }
}
