<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AccessPermission extends Model
{
    protected $table = 'permissions';

    protected $fillable = ['key', 'group'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(AccessRole::class, 'role_permissions', 'permission_id', 'role_id');
    }
}
