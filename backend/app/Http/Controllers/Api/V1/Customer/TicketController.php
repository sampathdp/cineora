<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Models\Booking;
use App\Models\Ticket;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A customer's own tickets. Refunds are filed by staff (the customer contacts the cinema). Everything is scoped through the booking owner. */
class TicketController extends Controller
{
    private const RELATIONS = ['bookingSeat', 'booking', 'showtime.movie', 'showtime.cinema', 'showtime.room'];

    public function index(Request $request): JsonResponse
    {
        $tickets = Ticket::query()->whereHas('booking', fn ($q) => $q->where('user_id', $request->user()->id))
            ->with(self::RELATIONS)->orderByDesc('issued_at')->orderBy('id')->limit(200)->get();

        return ApiResponse::success(TicketResource::collection($tickets)->resolve());
    }

    public function forBooking(Request $request, string $booking): JsonResponse
    {
        $b = Booking::where('public_id', $booking)->where('user_id', $request->user()->id)->firstOrFail();
        $tickets = Ticket::where('booking_id', $b->id)->with(self::RELATIONS)->orderBy('id')->get();

        return ApiResponse::success(TicketResource::collection($tickets)->resolve());
    }
}
