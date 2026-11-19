<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Cinema;
use App\Models\ScreeningRoom;
use App\Models\User;

class ScreeningRoomPolicy
{
    public function viewAny(User $user, Cinema $cinema): bool
    {
        return $user->canAt(Permission::CinemasView, $cinema);
    }

    public function view(User $user, ScreeningRoom $room): bool
    {
        return $user->canAt(Permission::CinemasView, $room->cinema_id);
    }

    public function create(User $user, Cinema $cinema): bool
    {
        return $user->canAt(Permission::RoomsManage, $cinema);
    }

    public function update(User $user, ScreeningRoom $room): bool
    {
        return $user->canAt(Permission::RoomsManage, $room->cinema_id);
    }

    public function delete(User $user, ScreeningRoom $room): bool
    {
        return $this->update($user, $room);
    }
}
