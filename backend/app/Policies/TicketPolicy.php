<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Showtime;
use App\Models\Ticket;
use App\Models\User;

class TicketPolicy
{
    public function view(User $user, Ticket $ticket): bool
    {
        return ($user->is_active && $ticket->booking->user_id === $user->getKey())
            || $user->canAt(Permission::TicketsView, $ticket->booking->cinema_id);
    }

    /** Scanning is limited to the checker's assigned cinemas. */
    public function validate(User $user, Showtime $showtime): bool
    {
        return $user->canAt(Permission::TicketsValidate, $showtime->cinema_id);
    }
}
