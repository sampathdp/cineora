<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Read-only view of the audit trail. There is no endpoint that edits or removes entries. */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::AuditView), 403);
        $v = $request->validate([
            'action' => ['sometimes', 'string', 'max:96'],
            'actor' => ['sometimes', 'string', 'max:255'],
            'resource_type' => ['sometimes', 'string', 'max:64'],
            'resource_id' => ['sometimes', 'string', 'max:64'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $tz = config('cineora.timezone');

        $page = AuditLog::query()->with('actor')
            ->when($v['action'] ?? null, fn ($q, $a) => $q->where('action', 'like', addcslashes($a, '%_\\').'%'))
            ->when($v['actor'] ?? null, fn ($q, $a) => $q->whereHas('actor', fn ($u) => $u->where('email', 'like', addcslashes($a, '%_\\').'%')))
            ->when($v['resource_type'] ?? null, fn ($q, $t) => $q->where('resource_type', $t))
            ->when($v['resource_id'] ?? null, fn ($q, $t) => $q->where('resource_id', $t))
            ->when($v['from'] ?? null, fn ($q, $d) => $q->where('created_at', '>=', Carbon::parse($d, $tz)->startOfDay()->utc()))
            ->when($v['to'] ?? null, fn ($q, $d) => $q->where('created_at', '<=', Carbon::parse($d, $tz)->endOfDay()->utc()))
            ->latest('id')->paginate($v['per_page'] ?? 50);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($l) => [
            'id' => $l->id, 'action' => $l->action, 'actor' => $l->actor ? ['name' => $l->actor->name, 'email' => $l->actor->email] : null,
            'resource_type' => $l->resource_type, 'resource_id' => $l->resource_id, 'metadata' => $l->metadata, 'ip' => $l->ip,
            'correlation_id' => $l->correlation_id, 'created_at' => $l->created_at?->copy()->utc()->toIso8601String(),
        ])->values()->all());
    }
}
