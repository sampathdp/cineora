<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Movie;
use App\Models\User;

class MoviePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::MoviesView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::MoviesManage);
    }

    public function update(User $user, Movie $movie): bool
    {
        return $user->hasPermission(Permission::MoviesManage);
    }

    public function publish(User $user, Movie $movie): bool
    {
        return $user->hasPermission(Permission::MoviesPublish);
    }
}
