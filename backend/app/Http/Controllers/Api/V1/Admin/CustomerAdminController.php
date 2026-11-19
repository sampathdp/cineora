<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only customer directory for staff holding customers.view. Only the minimum personal data is shown. */
class CustomerAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::CustomersView), 403);
        $v = $request->validate(['q' => ['sometimes', 'string', 'max:80'], 'per_page' => ['sometimes', 'integer', 'between:1,100']]);
        $scope = $request->user()->cinemaScope();

        $page = User::query()->whereHas('roles', fn ($r) => $r->where('roles.key', Role::Customer->value))
            ->whereDoesntHave('roles', fn ($r) => $r->where('roles.key', '!=', Role::Customer->value))
            // Cinema-scoped staff only see customers who have booked at their cinemas.
            ->when($scope !== null, fn ($q) => $q->whereHas('bookings', fn ($b) => $b->whereIn('cinema_id', $scope->all() ?: [0])))
            ->when($v['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('email', 'like', addcslashes($t, '%_\\').'%')->orWhere('name', 'like', '%'.addcslashes($t, '%_\\').'%')))
            ->withCount('bookings')->latest('id')->paginate($v['per_page'] ?? 25);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($u) => $this->present($u))->values()->all());
    }

    public function show(Request $request, User $user, AuditLogger $audit): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->hasPermission(Permission::CustomersView) && $user->hasRole(Role::Customer) && ! $user->isStaff(), 404);
        $scope = $viewer->cinemaScope();
        $bookings = Booking::where('user_id', $user->id)->when($scope !== null, fn ($q) => $q->whereIn('cinema_id', $scope->all() ?: [0]))->with('showtime.movie')->latest('id')->limit(20)->get();
        abort_if($scope !== null && $bookings->isEmpty(), 404);
        $audit->log('customer.viewed', $viewer, 'user', $user->public_id);

        return ApiResponse::success($this->present($user->loadCount('bookings')) + [
            'phone' => $user->profile?->phone,
            'recent_bookings' => $bookings->map(fn ($b) => ['id' => $b->public_id, 'reference' => $b->reference, 'status' => $b->status->value, 'total' => (int) $b->total, 'movie' => $b->showtime?->movie?->title])->values(),
        ]);
    }

    private function present(User $u): array
    {
        return ['id' => $u->public_id, 'name' => $u->name, 'email' => $u->email, 'email_verified' => $u->email_verified_at !== null, 'is_active' => $u->is_active, 'joined_at' => $u->created_at?->copy()->utc()->toIso8601String(), 'bookings' => (int) ($u->bookings_count ?? 0)];
    }
}
