<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\AuthUserResource;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Auth\MfaService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit, private readonly MfaService $mfa) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return $this->attempt($request, staffOnly: false);
    }

    /** Same credential check, but only accounts holding a staff role may sign in here. */
    public function staffLogin(LoginRequest $request): JsonResponse
    {
        return $this->attempt($request, staffOnly: true);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            $this->audit->log('auth.logout', $user, 'user', $user->public_id);
        }
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ApiResponse::success(null, 'Signed out.');
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success(new AuthUserResource($request->user()));
    }

    private function attempt(LoginRequest $request, bool $staffOnly): JsonResponse
    {
        $credentials = ['email' => mb_strtolower(trim($request->string('email')->toString())), 'password' => $request->input('password'), 'is_active' => true];

        $ok = Auth::guard('web')->attempt($credentials);
        /** @var User|null $user */
        $user = $ok ? Auth::guard('web')->user() : null;

        if ($ok && $staffOnly && ! $user->isStaff()) {
            Auth::guard('web')->logout();
            $ok = false;
        }

        if (! $ok) {
            $this->audit->log($staffOnly ? 'auth.staff_login_failed' : 'auth.login_failed', null, null, null, [
                'email_fp' => AuditLogger::fingerprint($request->string('email')->toString()),
            ]);

            // One generic message regardless of unknown email, wrong password, inactive account or wrong portal.
            throw ValidationException::withMessages(['email' => ['These credentials do not match our records.']]);
        }

        $request->session()->regenerate();
        $request->session()->forget('mfa_verified');
        $user->forceFill(['last_login_at' => now()])->save();
        $this->audit->log($staffOnly ? 'auth.staff_login' : 'auth.login', $user, 'user', $user->public_id);

        return ApiResponse::success([
            'user' => new AuthUserResource($user),
            'mfa_required' => $this->mfa->isEnabled($user),
            'mfa_setup_required' => ! $this->mfa->isEnabled($user) && $this->mfa->isRequiredFor($user),
        ], 'Signed in.');
    }
}
