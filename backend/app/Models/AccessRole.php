<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AccessRole extends Model
{
    protected $table = 'roles';

    protected $fillable = ['key', 'name', 'is_system'];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
        ];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(AccessPermission::class, 'role_permissions', 'role_id', 'permission_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_roles', 'role_id', 'user_id');
    }
}
