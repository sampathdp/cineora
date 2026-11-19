<?php

namespace Database\Seeders;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\AccessPermission;
use App\Models\AccessRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Idempotent: safe to run on every deploy. Never creates users. */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $permissionIds = [];
            foreach (Permission::cases() as $permission) {
                $permissionIds[$permission->value] = AccessPermission::updateOrCreate(
                    ['key' => $permission->value],
                    ['group' => $permission->group()],
                )->id;
            }

            foreach (Role::cases() as $role) {
                $model = AccessRole::updateOrCreate(
                    ['key' => $role->value],
                    ['name' => $role->label(), 'is_system' => true],
                );
                $model->permissions()->sync(
                    array_map(fn (Permission $p) => $permissionIds[$p->value], $role->permissions()),
                );
            }
        });
    }
}
