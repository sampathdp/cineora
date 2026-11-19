<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\ShowtimeSeatStatus;
use App\Enums\ShowtimeStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ShowtimeResource;
use App\Models\Cinema;
use App\Models\Showtime;
use App\Services\Showtime\AvailabilityService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Public schedule and live seat map. Only on-sale showtimes that have not started are visible. */
class ShowtimeController extends Controller
{
    public function __construct(private readonly AvailabilityService $availability) {}

    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'movie' => ['sometimes', 'string', 'max:200'],
            'cinema' => ['sometimes', 'string', 'max:160'],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'per_page' => ['sometimes', 'integer', 'between:1,200'],
        ]);

        $tz = config('cineora.timezone');
        if (isset($v['cinema'])) {
            $tz = Cinema::where('slug', $v['cinema'])->value('timezone') ?? $tz;
        }
        $from = now();
        $to = now()->addDays(14);
        if (isset($v['date'])) {
            // The calendar day is the cinema's local day, not UTC.
            $dayStart = Carbon::createFromFormat('Y-m-d', $v['date'], $tz)->startOfDay();
            $from = $dayStart->copy()->utc()->max(now());
            $to = $dayStart->copy()->addDay()->utc();
        }

        $now = now();
        $page = Showtime::query()
            ->where('status', ShowtimeStatus::OnSale->value)
            ->where('starts_at', '>', $from)->where('starts_at', '<', $to)
            ->whereHas('cinema', fn ($q) => $q->where('is_active', true)
                ->when($v['cinema'] ?? null, fn ($q, $slug) => $q->where('slug', $slug)))
            ->when($v['movie'] ?? null, fn ($q, $slug) => $q->whereHas('movie', fn ($m) => $m->where('slug', $slug)))
            ->whereHas('movie', fn ($m) => $m->where('status', 'published'))
            ->with(['movie', 'cinema', 'room', 'prices.category'])
            ->withCount(['seats as available_seats' => fn ($q) => $q
                ->whereHas('seat', fn ($s) => $s->where('is_active', true))
                ->where(fn ($w) => $w->where('status', ShowtimeSeatStatus::Available->value)
                    ->orWhere(fn ($h) => $h->where('status', ShowtimeSeatStatus::Held->value)->where('hold_expires_at', '<=', $now)
                        ->whereDoesntHave('booking', fn ($b) => $b->whereIn('status', ['PAYMENT_REVIEW', 'PAYMENT_EXCEPTION']))))])
            ->orderBy('starts_at')->orderBy('id')
            ->paginate($v['per_page'] ?? 100);

        return ApiResponse::success(
            ShowtimeResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        );
    }

    public function show(Showtime $showtime): JsonResponse
    {
        $this->assertVisible($showtime);
        $showtime->load(['movie', 'cinema', 'room', 'prices.category']);
        $showtime->available_seats = $this->availability->counts($showtime)['available'];

        return ApiResponse::success((new ShowtimeResource($showtime))->resolve());
    }

    /** Live seat map, rebuilt from the database on every request (never cached). */
    public function seats(Showtime $showtime): JsonResponse
    {
        $this->assertVisible($showtime);

        return ApiResponse::success([
            'showtime_id' => $showtime->public_id,
            'bookable' => $showtime->isBookable(),
            'seats' => $this->availability->seatMap($showtime),
        ]);
    }

    private function assertVisible(Showtime $showtime): void
    {
        abort_unless(
            $showtime->status === ShowtimeStatus::OnSale && $showtime->starts_at->gt(now()) && $showtime->cinema()->where('is_active', true)->exists(),
            404,
        );
    }
}
