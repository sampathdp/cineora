<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Ticket\TicketValidationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Lets a phone act as the camera for a signed-in door scanner.
 *
 * The desktop creates a pairing and shows its token as a QR code. The phone opens the link (no login), scans tickets
 * and posts them here; each scan is validated as the staff member who created the pairing, and the result is queued
 * for the desktop, which polls for it. The relay lives in the cache, so it works on hosting without websockets.
 * A pairing is a bearer credential: it expires, is revoked when the desktop disconnects, and only validates tickets.
 */
class ScannerPairController extends Controller
{
    private const TTL_MINUTES = 480;

    private const MAX_EVENTS = 30;

    /** Desktop: start a pairing for the signed-in checker. */
    public function create(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::TicketsValidate), 403);

        $token = Str::random(48);
        Cache::put($this->key($token), ['user_id' => $request->user()->id, 'seen_at' => null, 'seq' => 0, 'events' => []], now()->addMinutes(self::TTL_MINUTES));

        return ApiResponse::success(['token' => $token, 'expires_at' => now()->addMinutes(self::TTL_MINUTES)->utc()->toIso8601String()]);
    }

    /** Desktop: fetch scans the phone made after `after`, plus whether the phone is currently connected. */
    public function events(Request $request, string $token): JsonResponse
    {
        $pair = $this->ownedPair($request, $token);
        $after = (int) $request->query('after', 0);
        $seenAt = $pair['seen_at'] ?? null;

        return ApiResponse::success([
            'connected' => $seenAt !== null && now()->timestamp - $seenAt < 15,
            'events' => array_values(array_filter($pair['events'], fn ($e) => $e['seq'] > $after)),
        ]);
    }

    /** Desktop: end the pairing; the phone link stops working immediately. */
    public function destroy(Request $request, string $token): JsonResponse
    {
        $this->ownedPair($request, $token);
        Cache::forget($this->key($token));

        return ApiResponse::success(null, 'Phone disconnected.');
    }

    /** Phone: heartbeat; confirms the link is still valid. */
    public function ping(string $token): JsonResponse
    {
        $pair = $this->touch($token);

        return ApiResponse::success(['ok' => true, 'checker' => User::find($pair['user_id'])?->name]);
    }

    /** Phone: validate a scanned ticket as the pairing's checker and queue the result for the desktop. */
    public function scan(Request $request, string $token, TicketValidationService $validator): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required_without:reference', 'nullable', 'string', 'max:200'],
            'reference' => ['required_without:code', 'nullable', 'string', 'max:40'],
        ]);
        $pair = $this->touch($token);
        $checker = User::find($pair['user_id']);
        abort_unless($checker && $checker->hasPermission(Permission::TicketsValidate), 404, 'This pairing is no longer valid.');

        $result = $validator->validate($checker, $data['code'] ?? null, $data['reference'] ?? null, null);

        // Re-read under a lock so concurrent scans do not drop each other's events.
        Cache::lock($this->key($token).':lock', 5)->block(3, function () use ($token, $result) {
            $pair = Cache::get($this->key($token));
            if (! $pair) {
                return;
            }
            $pair['seq']++;
            $pair['events'][] = ['seq' => $pair['seq'], 'result' => $result];
            $pair['events'] = array_slice($pair['events'], -self::MAX_EVENTS);
            Cache::put($this->key($token), $pair, now()->addMinutes(self::TTL_MINUTES));
        });

        return ApiResponse::success($result);
    }

    private function key(string $token): string
    {
        return 'scanner-pair:'.hash('sha256', $token);
    }

    private function ownedPair(Request $request, string $token): array
    {
        $pair = Cache::get($this->key($token));
        abort_unless($pair && $pair['user_id'] === $request->user()->id, 404, 'Pairing not found.');

        return $pair;
    }

    private function touch(string $token): array
    {
        abort_unless(strlen($token) === 48, 404, 'This pairing is no longer valid.');
        $pair = Cache::get($this->key($token));
        abort_unless($pair, 404, 'This pairing is no longer valid.');
        $pair['seen_at'] = now()->timestamp;
        Cache::put($this->key($token), $pair, now()->addMinutes(self::TTL_MINUTES));

        return $pair;
    }
}
