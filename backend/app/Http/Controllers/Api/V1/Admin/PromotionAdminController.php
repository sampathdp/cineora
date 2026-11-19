<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Cinema;
use App\Models\Movie;
use App\Models\PromoCode;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Promo codes. All discount arithmetic happens in PromoService at booking time; this only manages the rules. */
class PromotionAdminController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        return ApiResponse::success(PromoCode::with(['movies', 'cinemas'])->latest('id')->limit(200)->get()->map(fn ($p) => $this->present($p))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validated($request, null);
        $promo = PromoCode::create($data['fields']);
        $this->syncRestrictions($promo, $data);
        $this->audit->log('promo.created', $request->user(), 'promo', $promo->code, ['type' => $promo->type->value]);

        return ApiResponse::success($this->present($promo->load(['movies', 'cinemas'])), 'Promo code created.', status: 201);
    }

    public function update(Request $request, PromoCode $promo): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validated($request, $promo);
        $promo->update($data['fields']);
        $this->syncRestrictions($promo, $data);
        $this->audit->log('promo.updated', $request->user(), 'promo', $promo->code, ['fields' => array_keys($data['fields'])]);

        return ApiResponse::success($this->present($promo->load(['movies', 'cinemas'])), 'Promo code updated.');
    }

    public function destroy(Request $request, PromoCode $promo): JsonResponse
    {
        $this->authorizeManage($request);
        if ($promo->redemptions()->exists()) {
            return ApiResponse::error('This code has been used. Deactivate it instead of deleting it.', 409, 'has_redemptions');
        }
        $promo->movies()->detach();
        $promo->cinemas()->detach();
        $promo->delete();
        $this->audit->log('promo.deleted', $request->user(), 'promo', $promo->code);

        return ApiResponse::success(null, 'Promo code deleted.');
    }

    private function authorizeManage(Request $request): void
    {
        abort_unless($request->user()->hasPermission(Permission::PromotionsManage), 403);
    }

    /** @return array{fields: array<string, mixed>, movies: ?list<string>, cinemas: ?list<string>} */
    private function validated(Request $request, ?PromoCode $existing): array
    {
        $req = $existing ? 'sometimes' : 'required';
        $v = $request->validate([
            'code' => [$req, 'string', 'regex:/^[A-Za-z0-9_\-]{3,32}$/', Rule::unique('promo_codes', 'code')->ignore($existing?->id)],
            'type' => [$req, Rule::in(['fixed', 'percent'])],
            'value' => [$req, 'integer', 'min:1', 'max:1000000'],
            'min_amount' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'max_discount' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000000'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date', 'after:starts_at'],
            'usage_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:10000000'],
            'per_user_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'movies' => ['sometimes', 'array', 'max:100'], 'movies.*' => ['string', 'size:26'],
            'cinemas' => ['sometimes', 'array', 'max:100'], 'cinemas.*' => ['string', 'size:26'],
        ]);
        $type = $v['type'] ?? $existing?->type?->value;
        $value = $v['value'] ?? (int) $existing?->value;
        if ($type === 'percent' && $value > 100) {
            abort(response()->json(['success' => false, 'message' => 'The submitted information is invalid.', 'code' => 'validation_failed', 'errors' => ['value' => ['A percentage cannot exceed 100.']]], 422));
        }
        $fields = collect($v)->except(['movies', 'cinemas'])->all();
        if (isset($fields['code'])) {
            $fields['code'] = strtoupper($fields['code']);
        }

        return ['fields' => $fields, 'movies' => $v['movies'] ?? null, 'cinemas' => $v['cinemas'] ?? null];
    }

    private function syncRestrictions(PromoCode $promo, array $data): void
    {
        if ($data['movies'] !== null) {
            $promo->movies()->sync(Movie::whereIn('public_id', $data['movies'])->pluck('id'));
        }
        if ($data['cinemas'] !== null) {
            $promo->cinemas()->sync(Cinema::whereIn('public_id', $data['cinemas'])->pluck('id'));
        }
    }

    private function present(PromoCode $p): array
    {
        return [
            'id' => $p->id, 'code' => $p->code, 'type' => $p->type->value, 'value' => (int) $p->value, 'min_amount' => (int) $p->min_amount,
            'max_discount' => $p->max_discount !== null ? (int) $p->max_discount : null,
            'starts_at' => $p->starts_at?->copy()->utc()->toIso8601String(), 'ends_at' => $p->ends_at?->copy()->utc()->toIso8601String(),
            'usage_limit' => $p->usage_limit, 'per_user_limit' => $p->per_user_limit, 'used_count' => (int) $p->used_count, 'is_active' => $p->is_active,
            'movies' => $p->movies->map(fn ($m) => ['id' => $m->public_id, 'title' => $m->title])->values(),
            'cinemas' => $p->cinemas->map(fn ($c) => ['id' => $c->public_id, 'name' => $c->name])->values(),
        ];
    }
}
