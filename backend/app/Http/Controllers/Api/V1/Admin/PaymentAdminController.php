<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Http\Controllers\Api\V1\Customer\PaymentController;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminPaymentResource;
use App\Models\Payment;
use App\Models\PaymentProof;
use App\Services\Audit\AuditLogger;
use App\Services\Payment\PaymentExceptionService;
use App\Services\Payment\PaymentReviewService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentAdminController extends Controller
{
    private const RELATIONS = ['booking.user', 'booking.seats', 'booking.showtime.movie', 'booking.showtime.cinema', 'bankAccount', 'proofs', 'reviews.reviewer'];

    public function __construct(
        private readonly PaymentReviewService $reviews,
        private readonly PaymentExceptionService $exceptions,
        private readonly AuditLogger $audit,
    ) {}

    /** Review queue. Staff only see payments of cinemas they are assigned to. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Payment::class);
        $v = $request->validate([
            'status' => ['sometimes', 'in:AWAITING_TRANSFER,PROOF_SUBMITTED,UNDER_REVIEW,VERIFIED,REJECTED,EXPIRED,EXCEPTION,REFUND_PENDING,PARTIALLY_REFUNDED,REFUNDED'],
            'queue' => ['sometimes', 'in:pending,exceptions'],
            'q' => ['sometimes', 'string', 'max:40'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $user = $request->user();

        $page = Payment::query()->with(self::RELATIONS)
            ->whereHas('booking', fn ($b) => $b->when(! $user->isSuperAdmin(), fn ($q) => $q->whereIn('cinema_id', $user->assignedCinemaIds())))
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when(($v['queue'] ?? null) === 'pending', fn ($q) => $q->whereIn('status', ['PROOF_SUBMITTED', 'UNDER_REVIEW']))
            ->when(($v['queue'] ?? null) === 'exceptions', fn ($q) => $q->where('status', 'EXCEPTION'))
            ->when($v['q'] ?? null, fn ($q, $t) => $q->where(fn ($w) => $w->where('payment_reference', 'like', addcslashes($t, '%_\\').'%')
                ->orWhereHas('booking', fn ($b) => $b->where('reference', 'like', addcslashes($t, '%_\\').'%'))))
            ->orderBy('submitted_at')->orderBy('id')->paginate($v['per_page'] ?? 25);

        return ApiResponse::success(
            AdminPaymentResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        );
    }

    public function show(Payment $payment): JsonResponse
    {
        Gate::authorize('viewAsStaff', $payment);

        return ApiResponse::success((new AdminPaymentResource($payment->load(self::RELATIONS)))->resolve());
    }

    /** Streams the proof file to an authorised reviewer. Every access is audited. */
    public function proof(Request $request, Payment $payment, int $proof): StreamedResponse
    {
        Gate::authorize('viewAsStaff', $payment);
        $file = PaymentProof::whereKey($proof)->where('payment_id', $payment->id)->firstOrFail();
        $this->audit->log('payment.proof_viewed', $request->user(), 'payment', $payment->public_id, ['proof' => $file->id]);

        return PaymentController::stream($file);
    }

    public function verify(Request $request, Payment $payment): JsonResponse
    {
        Gate::authorize('review', $payment);
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:1000']]);

        return ApiResponse::success((new AdminPaymentResource($this->reviews->verify($payment, $request->user(), $data['notes'] ?? null)->load(self::RELATIONS)))->resolve(), 'Payment verified. Tickets issued.');
    }

    public function reject(Request $request, Payment $payment): JsonResponse
    {
        Gate::authorize('review', $payment);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:300'], 'notes' => ['nullable', 'string', 'max:1000']]);

        return ApiResponse::success((new AdminPaymentResource($this->reviews->reject($payment, $request->user(), $data['reason'], $data['notes'] ?? null)->load(self::RELATIONS)))->resolve(), 'Payment rejected.');
    }

    public function exception(Request $request, Payment $payment): JsonResponse
    {
        Gate::authorize('review', $payment);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:300']]);

        return ApiResponse::success((new AdminPaymentResource($this->reviews->markException($payment, $request->user(), $data['reason'])->load(self::RELATIONS)))->resolve(), 'Sent to the exception queue.');
    }

    /** Administrator decision on an exception: accept the payment (if the seats are still valid) or cancel and refund. */
    public function resolve(Request $request, Payment $payment): JsonResponse
    {
        $booking = $payment->booking;
        Gate::authorize('resolveException', $booking);
        $data = $request->validate([
            'action' => ['required', 'in:confirm,cancel'],
            'note' => ['required', 'string', 'min:5', 'max:1000'],
            'acknowledge_amount_difference' => ['sometimes', 'boolean'],
        ]);
        $this->exceptions->assertResolvable($booking);

        $result = $data['action'] === 'confirm'
            ? $this->exceptions->confirm($payment, $request->user(), $data['note'], (bool) ($data['acknowledge_amount_difference'] ?? false))
            : $this->exceptions->cancel($payment, $request->user(), $data['note']);
        $this->audit->log('payment.exception_resolved', $request->user(), 'payment', $payment->public_id, ['action' => $data['action']]);

        return ApiResponse::success((new AdminPaymentResource($result->load(self::RELATIONS)))->resolve(), $data['action'] === 'confirm' ? 'Payment accepted. Tickets issued.' : 'Booking cancelled.');
    }
}
