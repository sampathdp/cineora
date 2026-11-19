<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/** Consistent JSON envelope for API responses. */
final class ApiResponse
{
    public static function success(mixed $data = null, string $message = 'Request completed successfully', array $meta = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => (object) $meta,
        ], $status);
    }

    /** Standard paginated list: `$items` are already-resolved arrays for the current page. */
    public static function paginated(\Illuminate\Contracts\Pagination\LengthAwarePaginator $page, array $items, array $extraMeta = []): JsonResponse
    {
        return self::success($items, meta: ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()] + $extraMeta);
    }

    public static function error(string $message, int $status, ?string $code = null, array $errors = []): JsonResponse
    {
        $body = ['success' => false, 'message' => $message];
        if ($code !== null) {
            $body['code'] = $code;
        }
        if ($errors !== []) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }
}
