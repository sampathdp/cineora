<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\User;

class UserPolicy
{
    public function manageStaff(User $actor): bool
    {
        return $actor->hasPermission(Permission::StaffManage);
    }

    /**
     * Anti-escalation: only grant roles whose permissions the actor already holds;
     * super admin can only be granted by a super admin.
     */
    public function assignRole(User $actor, User $target, Role $role): bool
    {
        if (! $actor->hasPermission(Permission::StaffManage)) {
            return false;
        }
        if ($role === Role::SuperAdmin) {
            return $actor->isSuperAdmin();
        }
        if ($actor->isSuperAdmin()) {
            return true;
        }
        // A non-super admin must not modify a super admin, and cannot grant what they lack.
        if ($target->isSuperAdmin()) {
            return false;
        }
        foreach ($role->permissions() as $permission) {
            if (! $actor->hasPermission($permission)) {
                return false;
            }
        }

        return true;
    }

    public function deactivate(User $actor, User $target): bool
    {
        if (! $actor->hasPermission(Permission::StaffManage) || $target->isLastActiveSuperAdmin()) {
            return false;
        }

        return $actor->isSuperAdmin() || ! $target->isSuperAdmin();
    }

    /** Same anti-escalation rules as assignRole(), for roles stored in the database (including custom ones). */
    public function assignAccessRole(User $actor, User $target, \App\Models\AccessRole $role): bool
    {
        if (! $actor->hasPermission(Permission::StaffManage)) {
            return false;
        }
        if ($role->key === Role::SuperAdmin->value) {
            return $actor->isSuperAdmin();
        }
        if ($actor->isSuperAdmin()) {
            return true;
        }
        if ($target->exists && $target->isSuperAdmin()) {
            return false;
        }

        $held = $actor->permissionKeys();

        return $role->permissions()->pluck('key')->every(fn (string $k) => $held->contains($k));
    }
}
