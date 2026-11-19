<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AccessPermission;
use App\Models\AccessRole;
use App\Models\User;
use App\Services\Admin\StaffService;
use App\Services\Auth\MfaService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Staff accounts, roles and permissions. Escalation rules are enforced in StaffService. */
class StaffAdminController extends Controller
{
    public function __construct(private readonly StaffService $staff, private readonly MfaService $mfa) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::StaffManage), 403);
        $v = $request->validate(['q' => ['sometimes', 'string', 'max:80'], 'per_page' => ['sometimes', 'integer', 'between:1,100']]);

        $page = User::query()->whereHas('roles', fn ($r) => $r->where('roles.key', '!=', 'customer'))->with(['roles', 'cinemas'])
            ->when($v['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('email', 'like', addcslashes($t, '%_\\').'%')->orWhere('name', 'like', '%'.addcslashes($t, '%_\\').'%')))
            ->orderBy('name')->paginate($v['per_page'] ?? 50);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($u) => $this->present($u))->values()->all());
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::StaffManage), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'roles' => ['required', 'array', 'min:1', 'max:6'],
            'roles.*' => ['string', 'max:64'],
            'cinemas' => ['sometimes', 'array', 'max:50'],
            'cinemas.*' => ['string', 'size:26'],
        ]);

        return ApiResponse::success($this->present($this->staff->create($request->user(), $data)), 'Account created. An email with a link to set a password was sent.', status: 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::StaffManage) && $user->isStaffOrHadRoles(), 404);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'roles' => ['sometimes', 'array', 'min:1', 'max:6'],
            'roles.*' => ['string', 'max:64'],
            'cinemas' => ['sometimes', 'array', 'max:50'],
            'cinemas.*' => ['string', 'size:26'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return ApiResponse::success($this->present($this->staff->update($request->user(), $user, $data)), 'Account updated.');
    }

    /** Super admins can clear a locked-out colleague's second factor; they must enrol again at next sign-in. */
    public function resetMfa(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin() && $user->isStaffOrHadRoles(), 403);
        abort_if($request->user()->is($user), 422, 'Use your own account page to change your second factor.');
        $this->mfa->disable($user);
        \Illuminate\Support\Facades\DB::table('sessions')->where('user_id', $user->id)->delete();
        app(\App\Services\Audit\AuditLogger::class)->log('staff.mfa_reset', $request->user(), 'user', $user->public_id);

        return ApiResponse::success(null, 'Two-factor authentication reset.');
    }

    public function roles(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::StaffManage) || $request->user()->hasPermission(Permission::RolesManage), 403);

        return ApiResponse::success(AccessRole::with('permissions')->withCount('users')->orderBy('id')->get()->map(fn ($r) => $this->presentRole($r))->values());
    }

    public function permissions(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::RolesManage), 403);

        return ApiResponse::success(AccessPermission::orderBy('group')->orderBy('key')->get(['key', 'group'])->groupBy('group')->map(fn ($g) => $g->pluck('key')->values()));
    }

    public function storeRole(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::RolesManage), 403);
        $data = $request->validate(['name' => ['required', 'string', 'min:3', 'max:60', 'regex:/^[\pL\pN _\-]+$/u'], 'permissions' => ['required', 'array', 'min:1'], 'permissions.*' => ['string', 'max:96']]);

        return ApiResponse::success($this->presentRole($this->staff->saveRole($request->user(), null, $data['name'], $data['permissions'])), 'Role created.', status: 201);
    }

    public function updateRole(Request $request, AccessRole $role): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::RolesManage), 403);
        $data = $request->validate(['name' => ['required', 'string', 'min:3', 'max:60', 'regex:/^[\pL\pN _\-]+$/u'], 'permissions' => ['required', 'array', 'min:1'], 'permissions.*' => ['string', 'max:96']]);

        return ApiResponse::success($this->presentRole($this->staff->saveRole($request->user(), $role, $data['name'], $data['permissions'])), 'Role updated.');
    }

    public function destroyRole(Request $request, AccessRole $role): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::RolesManage), 403);
        $this->staff->deleteRole($request->user(), $role);

        return ApiResponse::success(null, 'Role deleted.');
    }

    private function present(User $u): array
    {
        return [
            'id' => $u->public_id, 'name' => $u->name, 'email' => $u->email, 'is_active' => $u->is_active,
            'roles' => $u->roles->pluck('key')->values(), 'mfa_enabled' => $u->mfa_confirmed_at !== null,
            'last_login_at' => $u->last_login_at?->copy()->utc()->toIso8601String(),
            'cinemas' => $u->cinemas->map(fn ($c) => ['id' => $c->public_id, 'name' => $c->name])->values(),
        ];
    }

    private function presentRole(AccessRole $r): array
    {
        return ['key' => $r->key, 'name' => $r->name, 'is_system' => $r->is_system, 'users' => (int) ($r->users_count ?? 0), 'permissions' => $r->permissions->pluck('key')->sort()->values()];
    }
}
