<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    public function view(User $user, Payment $payment): bool
    {
        $booking = $payment->booking;

        return ($user->is_active && $booking->user_id === $user->getKey())
            || $user->canAt(Permission::PaymentsView, $booking->cinema_id);
    }

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::PaymentsView);
    }

    /** Staff-side view of a payment and its proof file. */
    public function viewAsStaff(User $user, Payment $payment): bool
    {
        return $user->canAt(Permission::PaymentsView, $payment->booking->cinema_id);
    }

    /** Submit proof: only the booking's own customer. */
    public function submitProof(User $user, Payment $payment): bool
    {
        return $user->is_active && $payment->booking->user_id === $user->getKey();
    }

    /**
     * Verify/reject: needs the permission for the booking's cinema, and may never be the
     * customer who owns the booking nor the person who submitted the proof.
     * Super administrators are exempt to allow full administrative override and testing.
     */
    public function review(User $user, Payment $payment): bool
    {
        if (! $user->canAt(Permission::PaymentsVerify, $payment->booking->cinema_id)) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $payment->booking->user_id !== $user->getKey()
            && $payment->submitted_by !== $user->getKey();
    }
}
