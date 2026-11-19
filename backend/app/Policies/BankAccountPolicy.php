<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class BankAccountPolicy
{
    public function manage(User $user): bool
    {
        return $user->hasPermission(Permission::PaymentsManageBankAccounts);
    }
}
