<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use App\Enums\Permission;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPublicId, Notifiable, SoftDeletes;

    /** Deliberately excludes is_active, mfa_* and role data: those are only set by dedicated services. */
    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token', 'mfa_secret', 'mfa_recovery_codes'];

    /** @var Collection<int, string>|null */
    private ?Collection $roleKeyCache = null;

    /** @var Collection<int, string>|null */
    private ?Collection $permissionKeyCache = null;

    /** @var Collection<int, int>|null */
    private ?Collection $cinemaIdCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'mfa_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'mfa_secret' => 'encrypted',
            'mfa_recovery_codes' => 'encrypted:array',
        ];
    }

    // --- Relations -------------------------------------------------------

    public function profile(): HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(AccessRole::class, 'user_roles', 'user_id', 'role_id')->withTimestamps();
    }

    public function cinemas(): BelongsToMany
    {
        return $this->belongsToMany(Cinema::class, 'staff_cinema_assignments', 'user_id', 'cinema_id')->withTimestamps();
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    // --- Authorization helpers (server-side source of truth) -------------

    /** Clear per-instance caches after role/assignment changes. */
    public function flushAccessCache(): void
    {
        $this->roleKeyCache = $this->permissionKeyCache = $this->cinemaIdCache = null;
    }

    /** @return Collection<int, string> */
    public function roleKeys(): Collection
    {
        return $this->roleKeyCache ??= $this->roles()->pluck('roles.key');
    }

    public function hasRole(Role $role): bool
    {
        return $this->is_active && $this->roleKeys()->contains($role->value);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(Role::SuperAdmin);
    }

    public function isStaff(): bool
    {
        // Any assigned role other than the plain customer role makes an account staff (custom roles included).
        return $this->is_active && $this->roleKeys()->contains(fn (string $key) => $key !== Role::Customer->value);
    }

    /** @return Collection<int, string> */
    public function permissionKeys(): Collection
    {
        return $this->permissionKeyCache ??= AccessPermission::query()
            ->whereHas('roles.users', fn ($q) => $q->where('users.id', $this->getKey()))
            ->pluck('key');
    }

    public function hasPermission(Permission $permission): bool
    {
        return $this->is_active && $this->permissionKeys()->contains($permission->value);
    }

    /** @return Collection<int, int> */
    public function assignedCinemaIds(): Collection
    {
        return $this->cinemaIdCache ??= $this->cinemas()->pluck('cinemas.id');
    }

    /**
     * Permission check including cinema scope: super admins act everywhere; everyone else
     * needs the permission AND an assignment to the target cinema when the permission is cinema-scoped.
     */
    public function canAt(Permission $permission, Cinema|int|null $cinema): bool
    {
        if (! $this->hasPermission($permission)) {
            return false;
        }
        if ($this->isSuperAdmin() || ! $permission->isCinemaScoped()) {
            return true;
        }
        if ($cinema === null) {
            return false;
        }

        return $this->assignedCinemaIds()->contains($cinema instanceof Cinema ? $cinema->getKey() : $cinema);
    }

    /**
     * Cinemas this user may see data for: null means "all" (super admin), otherwise the assigned cinema ids.
     * Use it to narrow every admin list/report/statistic query.
     *
     * @return Collection<int, int>|null
     */
    public function cinemaScope(): ?Collection
    {
        return $this->isSuperAdmin() ? null : $this->assignedCinemaIds();
    }

    /** True when the account holds (or held) any non-customer role; used to keep staff endpoints away from plain customers. */
    public function isStaffOrHadRoles(): bool
    {
        return $this->roles()->where('roles.key', '!=', Role::Customer->value)->exists();
    }

    /** True when this user is the only active super admin (guards removal/deactivation). */
    public function isLastActiveSuperAdmin(): bool
    {
        if (! $this->isSuperAdmin()) {
            return false;
        }

        return ! self::query()
            ->where('is_active', true)
            ->whereKeyNot($this->getKey())
            ->whereHas('roles', fn ($q) => $q->where('roles.key', Role::SuperAdmin->value))
            ->exists();
    }
}
