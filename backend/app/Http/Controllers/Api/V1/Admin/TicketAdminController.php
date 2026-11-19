<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\TicketValidationEvent;
use App\Services\Ticket\TicketValidationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Door check endpoints for ticket checkers (scoped to the cinemas they are assigned to). */
class TicketAdminController extends Controller
{
    public function validateTicket(Request $request, TicketValidationService $validator): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::TicketsValidate), 403);
        $data = $request->validate([
            'code' => ['required_without:reference', 'nullable', 'string', 'max:200'],
            'reference' => ['required_without:code', 'nullable', 'string', 'max:40'],
            'showtime' => ['sometimes', 'nullable', 'string', 'size:26'],
        ]);

        // Always HTTP 200: "not valid" is a normal answer at the door, not a failed request.
        return ApiResponse::success($validator->validate($request->user(), $data['code'] ?? null, $data['reference'] ?? null, $data['showtime'] ?? null));
    }

    /** The checker's recent attempts, for the scanner's activity list. */
    public function recent(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::TicketsValidate), 403);

        $events = TicketValidationEvent::query()->where('checker_id', $request->user()->id)->with('ticket.bookingSeat')->latest('id')->limit(25)->get();

        return ApiResponse::success($events->map(fn ($e) => [
            'outcome' => $e->outcome->value, 'seat' => $e->ticket?->bookingSeat?->seat_label, 'at' => $e->created_at?->copy()->utc()->toIso8601String(),
        ])->values());
    }
}
