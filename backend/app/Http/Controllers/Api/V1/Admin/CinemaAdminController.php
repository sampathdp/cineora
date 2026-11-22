<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CinemaRequest;
use App\Http\Requests\Admin\ImageUploadRequest;
use App\Http\Requests\Admin\RoomRequest;
use App\Http\Requests\Admin\SeatLayoutRequest;
use App\Http\Resources\AdminCinemaResource;
use App\Http\Resources\RoomResource;
use App\Models\Cinema;
use App\Models\CinemaImage;
use App\Models\ScreeningRoom;
use App\Models\SeatCategory;
use App\Services\Catalog\CinemaService;
use App\Services\Catalog\RoomService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class CinemaAdminController extends Controller
{
    public function __construct(private readonly CinemaService $cinemas, private readonly RoomService $rooms) {}

    /** Staff only see cinemas they are assigned to; super admins see all. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Cinema::class);
        $user = $request->user();

        $list = Cinema::query()->with($this->cinemas->relations())
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->whereIn('id', $user->assignedCinemaIds()))
            ->orderBy('name')->get();

        return ApiResponse::success(AdminCinemaResource::collection($list)->resolve());
    }

    public function show(Cinema $cinema): JsonResponse
    {
        Gate::authorize('view', $cinema);

        return ApiResponse::success((new AdminCinemaResource($cinema->load($this->cinemas->relations())))->resolve());
    }

    public function store(CinemaRequest $request): JsonResponse
    {
        Gate::authorize('create', Cinema::class);

        return ApiResponse::success((new AdminCinemaResource($this->cinemas->save($request->validated(), $request->user())))->resolve(), 'Cinema created.', status: 201);
    }

    public function update(CinemaRequest $request, Cinema $cinema): JsonResponse
    {
        Gate::authorize('update', $cinema);
        // Slug is fixed after creation so public URLs stay stable.
        $data = collect($request->validated())->except('slug')->all();

        return ApiResponse::success((new AdminCinemaResource($this->cinemas->save($data, $request->user(), $cinema)))->resolve(), 'Cinema updated.');
    }

    public function destroy(Request $request, Cinema $cinema): JsonResponse
    {
        Gate::authorize('delete', $cinema);
        $this->cinemas->delete($cinema, $request->user());

        return ApiResponse::success(null, 'Cinema deleted.');
    }

    public function addImage(ImageUploadRequest $request, Cinema $cinema): JsonResponse
    {
        Gate::authorize('update', $cinema);

        return ApiResponse::success((new AdminCinemaResource($this->cinemas->addImage($cinema, $request->file('image'), $request->input('alt'), $request->user())))->resolve(), 'Image added.', status: 201);
    }

    public function removeImage(Request $request, Cinema $cinema, CinemaImage $image): JsonResponse
    {
        Gate::authorize('update', $cinema);

        return ApiResponse::success((new AdminCinemaResource($this->cinemas->removeImage($cinema, $image, $request->user())))->resolve(), 'Image removed.');
    }

    // --- Rooms and seat layout ------------------------------------------------

    public function rooms(Cinema $cinema): JsonResponse
    {
        Gate::authorize('viewAny', [ScreeningRoom::class, $cinema]);

        return ApiResponse::success(RoomResource::collection($cinema->rooms()->withCount('seats')->orderBy('name')->get())->resolve());
    }

    public function storeRoom(RoomRequest $request, Cinema $cinema): JsonResponse
    {
        Gate::authorize('create', [ScreeningRoom::class, $cinema]);
        $room = $this->rooms->create($cinema, $request->validated(), $request->user());

        return ApiResponse::success((new RoomResource($room->loadCount('seats')))->resolve(), 'Room created.', status: 201);
    }

    public function updateRoom(RoomRequest $request, ScreeningRoom $room): JsonResponse
    {
        Gate::authorize('update', $room);

        return ApiResponse::success((new RoomResource($this->rooms->update($room, $request->validated(), $request->user())->loadCount('seats')))->resolve(), 'Room updated.');
    }

    public function destroyRoom(Request $request, ScreeningRoom $room): JsonResponse
    {
        Gate::authorize('delete', $room);
        $this->rooms->delete($room, $request->user());

        return ApiResponse::success(null, 'Room deleted.');
    }

    public function seats(ScreeningRoom $room): JsonResponse
    {
        Gate::authorize('view', $room);

        return ApiResponse::success((new RoomResource($room->load('seats.category')->loadCount('seats')))->resolve());
    }

    public function replaceSeats(SeatLayoutRequest $request, ScreeningRoom $room): JsonResponse
    {
        Gate::authorize('update', $room);
        $summary = $this->rooms->replaceLayout($room, $request->validated('seats'), $request->user());

        return ApiResponse::success($summary, 'Seat layout saved.');
    }

    public function seatCategories(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(\App\Enums\Permission::CinemasView), 403);

        return ApiResponse::success(SeatCategory::whereNull('cinema_id')->orderBy('id')->get(['key', 'name', 'default_price']));
    }
}
