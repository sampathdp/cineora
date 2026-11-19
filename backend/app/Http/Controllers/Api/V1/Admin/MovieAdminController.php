<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImageUploadRequest;
use App\Http\Requests\Admin\MovieRequest;
use App\Http\Resources\AdminMovieResource;
use App\Models\Movie;
use App\Services\Audit\AuditLogger;
use App\Services\Catalog\MovieService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MovieAdminController extends Controller
{
    public function __construct(private readonly MovieService $movies, private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Movie::class);
        $v = $request->validate([
            'q' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', 'in:draft,published,archived'],
            'screening_status' => ['sometimes', 'in:now_playing,coming_soon'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);

        $page = Movie::query()->with($this->movies->relations())
            ->when($v['q'] ?? null, fn ($q, $t) => $q->where('title', 'like', '%'.addcslashes($t, '%_\\').'%'))
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($v['screening_status'] ?? null, fn ($q, $s) => $q->where('screening_status', $s))
            ->latest('updated_at')->paginate($v['per_page'] ?? 20);

        return ApiResponse::success(
            AdminMovieResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        );
    }

    public function show(Movie $movie): JsonResponse
    {
        Gate::authorize('viewAny', Movie::class);

        return ApiResponse::success((new AdminMovieResource($movie->load($this->movies->relations())))->resolve());
    }

    public function store(MovieRequest $request): JsonResponse
    {
        Gate::authorize('create', Movie::class);
        $movie = $this->movies->save($request->validated(), $request->user());

        return ApiResponse::success((new AdminMovieResource($movie))->resolve(), 'Movie created as a draft.', status: 201);
    }

    public function update(MovieRequest $request, Movie $movie): JsonResponse
    {
        Gate::authorize('update', $movie);
        $movie = $this->movies->save($request->validated(), $request->user(), $movie);

        return ApiResponse::success((new AdminMovieResource($movie))->resolve(), 'Movie updated.');
    }

    public function publish(Request $request, Movie $movie): JsonResponse
    {
        Gate::authorize('publish', $movie);

        return ApiResponse::success((new AdminMovieResource($this->movies->publish($movie, $request->user())))->resolve(), 'Movie published.');
    }

    public function unpublish(Request $request, Movie $movie): JsonResponse
    {
        Gate::authorize('publish', $movie);

        return ApiResponse::success((new AdminMovieResource($this->movies->unpublish($movie, $request->user())))->resolve(), 'Movie moved back to draft.');
    }

    public function archive(Request $request, Movie $movie): JsonResponse
    {
        Gate::authorize('publish', $movie);

        return ApiResponse::success((new AdminMovieResource($this->movies->archive($movie, $request->user())))->resolve(), 'Movie archived.');
    }

    public function image(ImageUploadRequest $request, Movie $movie, string $kind): JsonResponse
    {
        Gate::authorize('update', $movie);
        abort_unless(in_array($kind, ['poster', 'banner'], true), 404);
        $movie = $this->movies->uploadImage($movie, $kind, $request->file('image'), $request->user());

        return ApiResponse::success((new AdminMovieResource($movie))->resolve(), ucfirst($kind).' updated.');
    }

    /** Soft delete. Movies with showtimes cannot be removed (history must stay intact): archive instead. */
    public function destroy(Request $request, Movie $movie): JsonResponse
    {
        Gate::authorize('update', $movie);
        if ($movie->showtimes()->exists()) {
            return ApiResponse::error('This movie has showtimes. Archive it instead of deleting.', 409, 'has_showtimes');
        }
        $movie->delete();
        $this->audit->log('movie.deleted', $request->user(), 'movie', $movie->public_id);

        return ApiResponse::success(null, 'Movie deleted.');
    }
}
