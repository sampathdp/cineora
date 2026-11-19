<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Cinema;
use App\Models\Showtime;
use App\Models\User;

class ShowtimePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::ShowtimesManage);
    }

    public function view(User $user, Showtime $showtime): bool
    {
        return $user->canAt(Permission::ShowtimesManage, $showtime->cinema_id);
    }

    public function create(User $user, Cinema $cinema): bool
    {
        return $user->canAt(Permission::ShowtimesManage, $cinema);
    }

    public function update(User $user, Showtime $showtime): bool
    {
        return $user->canAt(Permission::ShowtimesManage, $showtime->cinema_id);
    }

    public function managePrices(User $user, Showtime $showtime): bool
    {
        return $user->canAt(Permission::PricesManage, $showtime->cinema_id);
    }
}
