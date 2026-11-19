<?php

namespace Tests\Feature\Admin;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\AccessPermission;
use App\Models\AccessRole;
use App\Models\Cinema;
use App\Models\User;
use Tests\Feature\Ticket\TicketTestCase;

abstract class AdminTestCase extends TicketTestCase
{
    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->staff(Role::SuperAdmin);
    }

    protected function manager(?Cinema $cinema = null): User
    {
        $m = $this->staff(Role::CinemaManager);
        $m->cinemas()->attach($cinema ?? $this->cinema);
        $m->flushAccessCache();

        return $m;
    }

    /** A non-super-admin with exactly the given permissions (via a throw-away custom role). */
    protected function withPermissions(array $permissions, ?Cinema $cinema = null): User
    {
        $role = AccessRole::create(['key' => 'test_'.bin2hex(random_bytes(4)), 'name' => 'Test role', 'is_system' => false]);
        $role->permissions()->sync(AccessPermission::whereIn('key', array_map(fn ($p) => $p instanceof Permission ? $p->value : $p, $permissions))->pluck('id'));
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        if ($cinema) {
            $user->cinemas()->attach($cinema);
        }
        $user->flushAccessCache();

        return $user;
    }
}
