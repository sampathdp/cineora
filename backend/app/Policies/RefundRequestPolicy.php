<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\RefundRequest;
use App\Models\User;

class RefundRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::RefundsDecide);
    }

    public function decide(User $user, RefundRequest $refund): bool
    {
        return $user->canAt(Permission::RefundsDecide, $refund->booking->cinema_id);
    }
}
