<?php

namespace App\Http\Resources;

use App\Services\Auth\MfaService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class AuthUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $mfa = app(MfaService::class);
        $enabled = $mfa->isEnabled($this->resource);

        return [
            'id' => $this->public_id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->email_verified_at !== null,
            'is_staff' => $this->isStaff(),
            'roles' => $this->roleKeys()->values(),
            // UX hints only: the API re-checks every request.
            'permissions' => $this->permissionKeys()->values(),
            'cinemas' => $this->cinemas()->get(['cinemas.public_id', 'cinemas.name'])
                ->map(fn ($c) => ['id' => $c->public_id, 'name' => $c->name])->values(),
            'mfa' => [
                'enabled' => $enabled,
                'required' => $mfa->isRequiredFor($this->resource),
                'verified' => $enabled && (bool) $request->session()?->get('mfa_verified', false),
            ],
        ];
    }
}
