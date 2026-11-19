<?php

namespace App\Services\Admin;

use App\Enums\Role;
use App\Exceptions\DomainConflictException;
use App\Models\AccessPermission;
use App\Models\AccessRole;
use App\Models\Cinema;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Staff accounts, their roles and cinema assignments. The rules that stop privilege escalation live here:
 *  - you can only grant a role whose permissions you already hold (super admin roles only by a super admin);
 *  - you cannot change your own roles or deactivate yourself;
 *  - the last active super admin can never be demoted or deactivated;
 *  - non-super-admins can only assign cinemas they are assigned to themselves.
 */
class StaffService
{
    public function __construct(private readonly AuditLogger $audit, private readonly UserPolicy $policy) {}

    /**
     * @param  array{name: string, email: string, roles: list<string>, cinemas?: list<string>}  $data
     */
    public function create(User $actor, array $data): User
    {
        return DB::transaction(function () use ($actor, $data) {
            $user = new User(['name' => $data['name'], 'email' => mb_strtolower(trim($data['email'])), 'password' => Str::random(48)]);
            $roles = $this->resolveRoles($actor, $user, $data['roles']);
            $cinemaIds = $this->resolveCinemas($actor, $data['cinemas'] ?? []);

            $user->is_active = true;
            $user->email_verified_at = now(); // created by an administrator; the person sets their own password via the reset link
            $user->save();
            $user->roles()->attach($roles->mapWithKeys(fn ($r) => [$r->id => ['assigned_by' => $actor->id]])->all());
            $user->cinemas()->sync($cinemaIds);

            $this->audit->log('staff.created', $actor, 'user', $user->public_id, ['roles' => $roles->pluck('key')->all(), 'cinemas' => count($cinemaIds)]);
            Password::sendResetLink(['email' => $user->email]); // invitation: choose a password

            return $user->load(['roles', 'cinemas']);
        });
    }

    /**
     * @param  array{name?: string, roles?: list<string>, cinemas?: list<string>, is_active?: bool}  $data
     */
    public function update(User $actor, User $target, array $data): User
    {
        return DB::transaction(function () use ($actor, $target, $data) {
            $target = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            $self = $actor->is($target);

            if (isset($data['name'])) {
                $target->name = $data['name'];
            }

            if (array_key_exists('roles', $data)) {
                if ($self) {
                    throw new DomainConflictException('You cannot change your own roles.', 'self_modification');
                }
                $this->syncRoles($actor, $target, $data['roles']);
            }
            if (array_key_exists('cinemas', $data)) {
                $before = $target->cinemas()->pluck('cinemas.id')->sort()->values()->all();
                $ids = $this->resolveCinemas($actor, $data['cinemas'], keep: $target->cinemas()->pluck('cinemas.id')->all());
                $target->cinemas()->sync($ids);
                $this->audit->log('staff.cinemas_changed', $actor, 'user', $target->public_id, ['before' => $before, 'after' => collect($ids)->sort()->values()->all()]);
            }
            if (array_key_exists('is_active', $data) && (bool) $data['is_active'] !== $target->is_active) {
                $this->setActive($actor, $target, (bool) $data['is_active']);
            }
            $target->save();
            $target->flushAccessCache();
            $this->audit->log('staff.updated', $actor, 'user', $target->public_id, ['fields' => array_keys($data)]);

            return $target->load(['roles', 'cinemas']);
        });
    }

    private function setActive(User $actor, User $target, bool $active): void
    {
        if (! $active) {
            if ($actor->is($target)) {
                throw new DomainConflictException('You cannot deactivate your own account.', 'self_modification');
            }
            if (! $this->policy->deactivate($actor, $target)) {
                throw new DomainConflictException($target->isLastActiveSuperAdmin() ? 'The last active super admin cannot be deactivated.' : 'You are not allowed to deactivate this account.', 'not_allowed');
            }
            // Cut off every existing session immediately.
            DB::table('sessions')->where('user_id', $target->id)->delete();
        } elseif (! $actor->hasPermission(\App\Enums\Permission::StaffManage) || ($target->isSuperAdmin() && ! $actor->isSuperAdmin())) {
            throw new DomainConflictException('You are not allowed to reactivate this account.', 'not_allowed');
        }
        $target->is_active = $active;
        $this->audit->log($active ? 'staff.reactivated' : 'staff.deactivated', $actor, 'user', $target->public_id);
    }

    /** @param  list<string>  $keys */
    private function syncRoles(User $actor, User $target, array $keys): void
    {
        $wanted = $this->resolveRoles($actor, $target, $keys);
        $current = $target->roles()->get();
        $removed = $current->whereNotIn('id', $wanted->pluck('id'));

        foreach ($removed as $role) {
            if ($role->key === Role::SuperAdmin->value && $target->isLastActiveSuperAdmin()) {
                throw new DomainConflictException('The last active super admin cannot lose that role.', 'last_super_admin');
            }
            if (! $this->policy->assignAccessRole($actor, $target, $role)) {
                throw new DomainConflictException("You are not allowed to remove the {$role->name} role.", 'not_allowed');
            }
        }
        $before = $current->pluck('key')->sort()->values()->all();
        $target->roles()->sync($wanted->mapWithKeys(fn ($r) => [$r->id => ['assigned_by' => $actor->id]])->all());
        $this->audit->log('staff.roles_changed', $actor, 'user', $target->public_id, ['before' => $before, 'after' => $wanted->pluck('key')->sort()->values()->all()]);
    }

    /** @return \Illuminate\Support\Collection<int, AccessRole> */
    private function resolveRoles(User $actor, User $target, array $keys)
    {
        $keys = array_values(array_unique($keys));
        $roles = AccessRole::whereIn('key', $keys)->get();
        if ($roles->count() !== count($keys)) {
            throw ValidationException::withMessages(['roles' => ['Unknown role.']]);
        }
        if ($roles->contains(fn ($r) => $r->key === Role::Customer->value) && $roles->count() > 1) {
            throw ValidationException::withMessages(['roles' => ['The customer role cannot be combined with staff roles.']]);
        }
        if ($roles->isEmpty()) {
            throw ValidationException::withMessages(['roles' => ['Choose at least one role.']]);
        }
        foreach ($roles as $role) {
            if (! $this->policy->assignAccessRole($actor, $target, $role)) {
                throw new DomainConflictException("You are not allowed to grant the {$role->name} role.", 'privilege_escalation');
            }
        }

        return $roles;
    }

    /**
     * @param  list<string>  $publicIds
     * @param  list<int>  $keep  assignments the actor cannot see/change stay as they are
     * @return list<int>
     */
    private function resolveCinemas(User $actor, array $publicIds, array $keep = []): array
    {
        $ids = Cinema::whereIn('public_id', $publicIds)->pluck('id')->all();
        if (count($ids) !== count(array_unique($publicIds))) {
            throw ValidationException::withMessages(['cinemas' => ['Unknown cinema.']]);
        }
        $scope = $actor->cinemaScope();
        if ($scope !== null) {
            if (array_diff($ids, $scope->all())) {
                throw new DomainConflictException('You can only assign cinemas you are assigned to yourself.', 'privilege_escalation');
            }
            // Assignments to cinemas outside the actor's own scope are preserved, not silently dropped.
            $ids = array_values(array_unique([...$ids, ...array_diff($keep, $scope->all())]));
        }

        return $ids;
    }

    // --- Roles ---------------------------------------------------------------------------

    /** @param  list<string>  $permissionKeys */
    public function saveRole(User $actor, ?AccessRole $role, string $name, array $permissionKeys): AccessRole
    {
        return DB::transaction(function () use ($actor, $role, $name, $permissionKeys) {
            if ($role?->is_system) {
                throw new DomainConflictException('Built-in roles cannot be edited.', 'system_role');
            }
            $perms = AccessPermission::whereIn('key', $permissionKeys)->get();
            if ($perms->count() !== count(array_unique($permissionKeys))) {
                throw ValidationException::withMessages(['permissions' => ['Unknown permission.']]);
            }
            // You cannot hand out a permission you do not hold yourself.
            $missing = $perms->pluck('key')->reject(fn ($k) => $actor->permissionKeys()->contains($k));
            if ($missing->isNotEmpty() && ! $actor->isSuperAdmin()) {
                throw new DomainConflictException('You cannot grant permissions you do not hold: '.$missing->implode(', ').'.', 'privilege_escalation');
            }
            if ($role === null) {
                $slug = 'custom_'.Str::slug($name, '_');
                if (AccessRole::where('key', $slug)->exists()) {
                    throw ValidationException::withMessages(['name' => ['A role with this name already exists.']]);
                }
                $role = AccessRole::create(['key' => $slug, 'name' => $name, 'is_system' => false]);
                $this->audit->log('role.created', $actor, 'role', $role->key, ['permissions' => $perms->pluck('key')->all()]);
            } else {
                $before = $role->permissions()->pluck('key')->sort()->values()->all();
                $role->update(['name' => $name]);
                $this->audit->log('role.permissions_changed', $actor, 'role', $role->key, ['before' => $before, 'after' => $perms->pluck('key')->sort()->values()->all()]);
            }
            $role->permissions()->sync($perms->pluck('id'));

            return $role->load('permissions');
        });
    }

    public function deleteRole(User $actor, AccessRole $role): void
    {
        if ($role->is_system) {
            throw new DomainConflictException('Built-in roles cannot be deleted.', 'system_role');
        }
        if ($role->users()->exists()) {
            throw new DomainConflictException('This role is still assigned to people.', 'role_in_use');
        }
        $role->permissions()->detach();
        $role->delete();
        $this->audit->log('role.deleted', $actor, 'role', $role->key);
    }
}
