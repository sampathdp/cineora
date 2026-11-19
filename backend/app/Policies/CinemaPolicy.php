<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Cinema;
use App\Models\User;

class CinemaPolicy
{
    /** Admin listing; the controller narrows results to the user's assigned cinemas. */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::CinemasView);
    }

    public function view(User $user, Cinema $cinema): bool
    {
        return $user->canAt(Permission::CinemasView, $cinema);
    }

    /** Creating a new cinema is a platform-level action. */
    public function create(User $user): bool
    {
        return $user->isSuperAdmin() && $user->hasPermission(Permission::CinemasManage);
    }

    public function update(User $user, Cinema $cinema): bool
    {
        return $user->canAt(Permission::CinemasManage, $cinema);
    }

    public function delete(User $user, Cinema $cinema): bool
    {
        return $user->isSuperAdmin() && $user->hasPermission(Permission::CinemasManage);
    }
}
