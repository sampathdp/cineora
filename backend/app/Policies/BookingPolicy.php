<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    public function view(User $user, Booking $booking): bool
    {
        return $this->owns($user, $booking) || $user->canAt(Permission::BookingsView, $booking->cinema_id);
    }

    /** Customer identity/contact details: separate, narrower permission. */
    public function viewCustomer(User $user, Booking $booking): bool
    {
        return $user->canAt(Permission::BookingsViewCustomer, $booking->cinema_id);
    }

    /** Eligibility by status is enforced in the state machine; this is only "who may ask". */
    public function cancel(User $user, Booking $booking): bool
    {
        return $this->owns($user, $booking) || $user->canAt(Permission::BookingsCancel, $booking->cinema_id);
    }

    public function resolveException(User $user, Booking $booking): bool
    {
        return $user->canAt(Permission::BookingsResolveExceptions, $booking->cinema_id);
    }

    private function owns(User $user, Booking $booking): bool
    {
        return $user->is_active && $booking->user_id === $user->getKey();
    }
}
