<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\MovieStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CinemaResource;
use App\Http\Resources\MovieResource;
use App\Models\Cinema;
use App\Models\Genre;
use App\Models\Movie;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Unauthenticated, read-only catalogue. Only published movies and active cinemas are ever returned. */
class CatalogController extends Controller
{
    public function movies(Request $request): JsonResponse
    {
        $v = $request->validate([
            'screening_status' => ['sometimes', 'in:now_playing,coming_soon'],
            'genre' => ['sometimes', 'string', 'max:64'],
            'q' => ['sometimes', 'string', 'max:100'],
            'featured' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', 'in:release_date,-release_date,title,-title,rating,-rating'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);

        $query = Movie::query()
            ->where('status', MovieStatus::Published->value)
            ->with(['genres', 'cast', 'crew'])
            ->when($v['screening_status'] ?? null, fn ($q, $s) => $q->where('screening_status', $s))
            ->when($v['genre'] ?? null, fn ($q, $g) => $q->whereHas('genres', fn ($gq) => $gq->where('slug', $g)))
            ->when($v['q'] ?? null, fn ($q, $term) => $q->where(function ($w) use ($term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $w->where('title', 'like', $like)->orWhere('tagline', 'like', $like);
            }))
            ->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true));

        $sort = $v['sort'] ?? '-release_date';
        $query->orderBy(ltrim($sort, '-'), str_starts_with($sort, '-') ? 'desc' : 'asc')->orderBy('id');

        $page = $query->paginate($v['per_page'] ?? 24);

        return ApiResponse::success(
            MovieResource::collection($page->items())->resolve(),
            meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        );
    }

    public function movie(Movie $movie): JsonResponse
    {
        abort_unless($movie->status === MovieStatus::Published, 404);

        return ApiResponse::success((new MovieResource($movie->load(['genres', 'cast', 'crew', 'languages'])))->resolve());
    }

    public function genres(): JsonResponse
    {
        return ApiResponse::success(Genre::orderBy('name')->get(['slug', 'name']));
    }

    public function cinemas(): JsonResponse
    {
        $cinemas = Cinema::query()->where('is_active', true)->orderBy('name')
            ->with(['facilities', 'images', 'rooms' => fn ($q) => $q->where('is_active', true)->withCount('seats')])->get();

        return ApiResponse::success(CinemaResource::collection($cinemas)->resolve());
    }

    public function cinema(Cinema $cinema): JsonResponse
    {
        abort_unless($cinema->is_active, 404);

        return ApiResponse::success((new CinemaResource($cinema->load(['facilities', 'images', 'rooms' => fn ($q) => $q->where('is_active', true)->withCount('seats')])))->resolve());
    }
}
