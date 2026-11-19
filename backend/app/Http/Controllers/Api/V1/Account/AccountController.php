<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\AuthUserResource;
use App\Models\CustomerProfile;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->profile;

        return ApiResponse::success([
            'user' => new AuthUserResource($user),
            'phone' => $profile?->phone,
            'locale' => $profile?->locale ?? 'en',
            'marketing_opt_in' => (bool) $profile?->marketing_opt_in,
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        DB::transaction(function () use ($user, $data) {
            if (isset($data['name'])) {
                $user->forceFill(['name' => $data['name']])->save();
            }
            $profileData = array_intersect_key($data, array_flip(['phone', 'locale', 'marketing_opt_in']));
            if ($profileData !== []) {
                CustomerProfile::updateOrCreate(['user_id' => $user->id], $profileData);
            }
        });
        $this->audit->log('account.profile_updated', $user, 'user', $user->public_id, ['fields' => array_keys($data)]);

        return $this->profile($request->merge([]));
    }

    /** Active sessions for the signed-in user (database session driver). */
    public function sessions(Request $request): JsonResponse
    {
        $current = $request->session()->getId();
        $rows = DB::table('sessions')->where('user_id', $request->user()->getKey())->orderByDesc('last_activity')->get(['id', 'ip_address', 'user_agent', 'last_activity']);

        return ApiResponse::success($rows->map(fn ($s) => [
            'id' => hash('sha256', $s->id), // opaque handle; the real session id never leaves the server
            'ip' => $s->ip_address,
            'user_agent' => mb_substr((string) $s->user_agent, 0, 160),
            'last_active_at' => date(DATE_ATOM, (int) $s->last_activity),
            'current' => $s->id === $current,
        ])->values());
    }

    public function revokeSession(Request $request, string $handle): JsonResponse
    {
        $current = $request->session()->getId();
        $target = DB::table('sessions')->where('user_id', $request->user()->getKey())->get(['id'])
            ->first(fn ($s) => hash_equals(hash('sha256', $s->id), $handle));

        if (! $target) {
            return ApiResponse::error('Resource not found.', 404, 'not_found');
        }
        if ($target->id === $current) {
            return ApiResponse::error('Use sign out to end the current session.', 422, 'current_session');
        }
        DB::table('sessions')->where('id', $target->id)->delete();
        $this->audit->log('account.session_revoked', $request->user(), 'user', $request->user()->public_id);

        return ApiResponse::success(null, 'Session ended.');
    }
}
