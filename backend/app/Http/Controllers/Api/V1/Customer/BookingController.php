<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\Booking\BookingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A customer's own bookings. Every query is scoped to the authenticated user: other people's bookings simply do not exist here. */
class BookingController extends Controller
{
    private const RELATIONS = ['seats', 'showtime.movie', 'showtime.cinema', 'showtime.room'];

    public function __construct(private readonly BookingService $bookings) {}

    public function store(CreateBookingRequest $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasVerifiedEmail()) {
            return ApiResponse::error('Please verify your email address before booking.', 403, 'email_unverified');
        }

        [$booking, $replayed] = $this->bookings->create($user, $request->safe()->only(['showtime', 'seats', 'promo_code']), $request->validated('idempotency_key'));
        $booking->load(self::RELATIONS);

        return ApiResponse::success(
            (new BookingResource($booking))->resolve(),
            $replayed ? 'This request was already processed.' : 'Seats reserved. Complete your bank transfer before the hold expires.',
            ['server_now' => now()->utc()->toIso8601String(), 'replayed' => $replayed],
            $replayed ? 200 : 201,
        )->header('Idempotent-Replayed', $replayed ? 'true' : 'false');
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate(['per_page' => ['sometimes', 'integer', 'between:1,50']]);

        $page = Booking::query()->where('user_id', $request->user()->id)->with(self::RELATIONS)
            ->latest('created_at')->latest('id')->paginate((int) $request->input('per_page', 10));

        return ApiResponse::success(
            BookingResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage(), 'server_now' => now()->utc()->toIso8601String()],
        );
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        return ApiResponse::success(
            (new BookingResource($this->owned($request, $booking)->load(self::RELATIONS)))->resolve(),
            meta: ['server_now' => now()->utc()->toIso8601String()],
        );
    }

    public function cancel(Request $request, string $booking): JsonResponse
    {
        $cancelled = $this->bookings->cancelUnpaid($this->owned($request, $booking), $request->user());

        return ApiResponse::success((new BookingResource($cancelled->load(self::RELATIONS)))->resolve(), 'Booking cancelled and seats released.');
    }

    /** 404 (not 403) for someone else's booking, so existence is not revealed. */
    private function owned(Request $request, string $publicId): Booking
    {
        return Booking::where('public_id', $publicId)->where('user_id', $request->user()->id)->firstOrFail();
    }
}
