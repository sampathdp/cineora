<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\RefundRequest;
use App\Services\Payment\RefundService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class RefundAdminController extends Controller
{
    public function __construct(private readonly RefundService $refunds) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', RefundRequest::class);
        $v = $request->validate(['status' => ['sometimes', 'in:pending,approved,denied,paid']]);
        $user = $request->user();

        $list = RefundRequest::query()->with(['booking.showtime.movie', 'booking.user'])
            ->whereHas('booking', fn ($b) => $b->when(! $user->isSuperAdmin(), fn ($q) => $q->whereIn('cinema_id', $user->assignedCinemaIds())))
            ->when($v['status'] ?? 'pending', fn ($q, $s) => $q->where('status', $s))
            ->orderBy('created_at')->limit(100)->get();

        return ApiResponse::success($list->map(fn ($r) => $this->present($r))->values());
    }

    public function deny(Request $request, RefundRequest $refund): JsonResponse
    {
        Gate::authorize('decide', $refund);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:300']]);

        return ApiResponse::success($this->present($this->refunds->deny($refund, $request->user(), $data['reason'])->load('booking.showtime.movie')), 'Refund request denied.');
    }

    public function pay(Request $request, RefundRequest $refund): JsonResponse
    {
        Gate::authorize('decide', $refund);
        $data = $request->validate(['reference' => ['required', 'string', 'min:3', 'max:80']]);

        return ApiResponse::success($this->present($this->refunds->markPaid($refund, $request->user(), $data['reference'])->load('booking.showtime.movie')), 'Refund recorded as paid.');
    }

    private function present(RefundRequest $r): array
    {
        return [
            'id' => $r->public_id, 'status' => $r->status->value, 'amount' => (int) $r->amount, 'reason' => $r->reason,
            'created_at' => $r->created_at?->copy()->utc()->toIso8601String(),
            'booking' => ['id' => $r->booking->public_id, 'reference' => $r->booking->reference, 'status' => $r->booking->status->value, 'movie' => $r->booking->showtime?->movie?->title],
        ];
    }
}
