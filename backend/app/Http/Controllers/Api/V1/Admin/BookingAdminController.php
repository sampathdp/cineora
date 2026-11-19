<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Enums\Permission;
use App\Exceptions\DomainConflictException;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\Booking\BookingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Staff view of bookings, limited to assigned cinemas. Customer identity needs its own permission. */
class BookingAdminController extends Controller
{
    private const RELATIONS = ['seats', 'user', 'showtime.movie', 'showtime.cinema', 'showtime.room', 'payments'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->hasPermission(Permission::BookingsView), 403);
        $v = $request->validate([
            'q' => ['sometimes', 'string', 'max:60'],
            'status' => ['sometimes', 'in:'.implode(',', array_column(BookingStatus::cases(), 'value'))],
            'cinema' => ['sometimes', 'string', 'size:26'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $scope = $user->cinemaScope();
        $canSeeCustomers = $user->hasPermission(Permission::BookingsViewCustomer);

        $page = Booking::query()->with(self::RELATIONS)
            ->when($scope !== null, fn ($q) => $q->whereIn('cinema_id', $scope->all() ?: [0]))
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($v['cinema'] ?? null, fn ($q, $id) => $q->whereHas('cinema', fn ($c) => $c->where('public_id', $id)))
            ->when($v['from'] ?? null, fn ($q, $d) => $q->where('created_at', '>=', \Illuminate\Support\Carbon::parse($d, config('cineora.timezone'))->startOfDay()->utc()))
            ->when($v['to'] ?? null, fn ($q, $d) => $q->where('created_at', '<=', \Illuminate\Support\Carbon::parse($d, config('cineora.timezone'))->endOfDay()->utc()))
            ->when($v['q'] ?? null, function ($q, $term) use ($canSeeCustomers) {
                $like = addcslashes($term, '%_\\').'%';
                // Searching by customer email is only possible for staff who may see customers at all.
                $q->where(fn ($w) => $w->where('reference', 'like', $like)
                    ->when($canSeeCustomers, fn ($w) => $w->orWhereHas('user', fn ($u) => $u->where('email', 'like', $like))));
            })
            ->latest('created_at')->latest('id')->paginate($v['per_page'] ?? 25);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($b) => $this->present($b, $request))->values()->all());
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        Gate::authorize('view', $booking);

        return ApiResponse::success($this->present($booking->load([...self::RELATIONS, 'histories.actor']), $request, detailed: true));
    }

    /** Staff can cancel unpaid bookings. Paid ones go through the refund workflow. */
    public function cancel(Request $request, Booking $booking, BookingService $bookings): JsonResponse
    {
        Gate::authorize('cancel', $booking);
        if (! in_array($booking->status, [BookingStatus::PENDING_PAYMENT, BookingStatus::PAYMENT_REJECTED], true)) {
            throw new DomainConflictException('Only unpaid bookings can be cancelled here. Paid bookings are cancelled through a refund request.', 'use_refund_workflow');
        }
        $cancelled = $bookings->cancelUnpaid($booking, $request->user(), 'cancelled by staff');

        return ApiResponse::success($this->present($cancelled->load(self::RELATIONS), $request), 'Booking cancelled and seats released.');
    }

    private function present(Booking $b, Request $request, bool $detailed = false): array
    {
        $viewer = $request->user();
        $canSeeCustomer = $viewer->canAt(Permission::BookingsViewCustomer, $b->cinema_id);
        $out = [
            'id' => $b->public_id, 'reference' => $b->reference, 'status' => $b->status->value,
            'subtotal' => (int) $b->subtotal, 'discount' => (int) $b->discount, 'fee' => (int) $b->fee, 'total' => (int) $b->total, 'currency' => $b->currency,
            'created_at' => $b->created_at?->copy()->utc()->toIso8601String(),
            'hold_expires_at' => $b->hold_expires_at->copy()->utc()->toIso8601String(),
            'payment_deadline_at' => $b->payment_deadline_at->copy()->utc()->toIso8601String(),
            'seats' => $b->seats->sortBy('seat_label', SORT_NATURAL)->map(fn ($s) => ['label' => $s->seat_label, 'category' => $s->category_name, 'unit_price' => (int) $s->unit_price])->values(),
            'showtime' => $b->showtime ? [
                'id' => $b->showtime->public_id, 'starts_at' => $b->showtime->starts_at->copy()->utc()->toIso8601String(),
                'movie' => $b->showtime->movie->title, 'cinema' => $b->showtime->cinema->name, 'room' => $b->showtime->room->name,
            ] : null,
            'customer' => $canSeeCustomer ? ['name' => $b->user->name, 'email' => $b->user->email] : null,
        ];
        if ($detailed) {
            $out['payments'] = $b->payments->map(fn ($p) => ['id' => $p->public_id, 'status' => $p->status->value, 'expected_amount' => (int) $p->expected_amount, 'submitted_amount' => $p->submitted_amount !== null ? (int) $p->submitted_amount : null])->values();
            $out['history'] = $b->histories->sortBy('id')->map(fn ($h) => ['from' => $h->from_status, 'to' => $h->to_status, 'reason' => $h->reason, 'actor' => $h->actor?->name, 'at' => $h->created_at?->copy()->utc()->toIso8601String()])->values();
        }

        return $out;
    }
}
