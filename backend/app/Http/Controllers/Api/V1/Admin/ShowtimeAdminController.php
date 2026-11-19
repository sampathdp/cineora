<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ShowtimePricesRequest;
use App\Http\Requests\Admin\ShowtimeRequest;
use App\Http\Resources\AdminShowtimeResource;
use App\Models\Movie;
use App\Models\ScreeningRoom;
use App\Models\Showtime;
use App\Services\Showtime\AvailabilityService;
use App\Services\Showtime\ShowtimeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class ShowtimeAdminController extends Controller
{
    public function __construct(private readonly ShowtimeService $showtimes, private readonly AvailabilityService $availability) {}

    /** Staff only see showtimes of cinemas they are assigned to. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Showtime::class);
        $v = $request->validate([
            'cinema' => ['sometimes', 'string', 'size:26'],
            'movie' => ['sometimes', 'string', 'size:26'],
            'status' => ['sometimes', 'in:draft,on_sale,cancelled,completed'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $user = $request->user();

        $page = Showtime::query()->with($this->showtimes->relations())
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->whereIn('cinema_id', $user->assignedCinemaIds()))
            ->when($v['cinema'] ?? null, fn ($q, $id) => $q->whereHas('cinema', fn ($c) => $c->where('public_id', $id)))
            ->when($v['movie'] ?? null, fn ($q, $id) => $q->whereHas('movie', fn ($m) => $m->where('public_id', $id)))
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($v['from'] ?? null, fn ($q, $d) => $q->where('starts_at', '>=', Carbon::parse($d)->utc()))
            ->when($v['to'] ?? null, fn ($q, $d) => $q->where('starts_at', '<', Carbon::parse($d)->utc()))
            ->orderBy('starts_at')->orderBy('id')->paginate($v['per_page'] ?? 25);

        return ApiResponse::success(
            AdminShowtimeResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        );
    }

    public function show(Showtime $showtime): JsonResponse
    {
        Gate::authorize('view', $showtime);
        $showtime->load($this->showtimes->relations());

        return ApiResponse::success([...(new AdminShowtimeResource($showtime))->resolve(), 'seat_counts' => $this->availability->counts($showtime)]);
    }

    public function seats(Showtime $showtime): JsonResponse
    {
        Gate::authorize('view', $showtime);

        return ApiResponse::success(['seats' => $this->availability->seatMap($showtime)]);
    }

    public function store(ShowtimeRequest $request): JsonResponse
    {
        $room = ScreeningRoom::where('public_id', $request->validated('room'))->firstOrFail();
        Gate::authorize('create', [Showtime::class, $room->cinema]);

        $showtime = $this->showtimes->create($this->internal($request->validated()), $request->user());

        return ApiResponse::success((new AdminShowtimeResource($showtime))->resolve(), 'Showtime created as a draft.', status: 201);
    }

    public function update(ShowtimeRequest $request, Showtime $showtime): JsonResponse
    {
        Gate::authorize('update', $showtime);
        $data = $this->internal($request->validated());
        if (isset($data['room_id'])) {
            // Moving to another room also requires rights over the destination cinema.
            Gate::authorize('create', [Showtime::class, ScreeningRoom::findOrFail($data['room_id'])->cinema]);
        }

        return ApiResponse::success((new AdminShowtimeResource($this->showtimes->update($showtime, $data, $request->user())))->resolve(), 'Showtime updated.');
    }

    public function prices(ShowtimePricesRequest $request, Showtime $showtime): JsonResponse
    {
        Gate::authorize('managePrices', $showtime);

        return ApiResponse::success((new AdminShowtimeResource($this->showtimes->setPrices($showtime, $request->validated('prices'), $request->user())))->resolve(), 'Prices updated.');
    }

    public function publish(Request $request, Showtime $showtime): JsonResponse
    {
        Gate::authorize('update', $showtime);

        return ApiResponse::success((new AdminShowtimeResource($this->showtimes->publish($showtime, $request->user())))->resolve(), 'Showtime is on sale.');
    }

    public function cancel(Request $request, Showtime $showtime): JsonResponse
    {
        Gate::authorize('update', $showtime);

        return ApiResponse::success((new AdminShowtimeResource($this->showtimes->cancel($showtime, $request->user())))->resolve(), 'Showtime cancelled.');
    }

    /** Public ULIDs from the request become internal ids for the service. */
    private function internal(array $data): array
    {
        if (isset($data['movie'])) {
            $data['movie_id'] = Movie::where('public_id', $data['movie'])->value('id');
        }
        if (isset($data['room'])) {
            $data['room_id'] = ScreeningRoom::where('public_id', $data['room'])->value('id');
        }
        unset($data['movie'], $data['room']);

        return $data;
    }
}
