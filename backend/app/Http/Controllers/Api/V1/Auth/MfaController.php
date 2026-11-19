<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MfaCodeRequest;
use App\Services\Audit\AuditLogger;
use App\Services\Auth\MfaService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MfaController extends Controller
{
    public function __construct(private readonly MfaService $mfa, private readonly AuditLogger $audit) {}

    /** Step 1: generate a secret. Requires the account password (re-authentication). */
    public function setup(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string', 'current_password:web']]);
        $user = $request->user();

        if ($this->mfa->isEnabled($user)) {
            return ApiResponse::error('Two-factor authentication is already enabled.', 409, 'mfa_already_enabled');
        }

        return ApiResponse::success($this->mfa->beginEnrolment($user), 'Scan the secret with an authenticator app, then confirm with a code.');
    }

    /** Step 2: prove possession of the secret; returns one-time recovery codes. */
    public function confirm(MfaCodeRequest $request): JsonResponse
    {
        $user = $request->user();
        if ($this->mfa->isEnabled($user) || ! $user->mfa_secret) {
            return ApiResponse::error('No pending two-factor setup.', 409, 'mfa_not_pending');
        }
        if (! $this->mfa->verifyCode($user, (string) $request->input('code'))) {
            throw ValidationException::withMessages(['code' => ['The code is invalid or expired.']]);
        }

        $codes = $this->mfa->confirmEnrolment($user);
        $request->session()->regenerate();
        $request->session()->put('mfa_verified', true);
        $this->audit->log('auth.mfa_enabled', $user, 'user', $user->public_id);

        return ApiResponse::success(['recovery_codes' => $codes], 'Two-factor authentication enabled. Store these recovery codes safely; they are shown only once.');
    }

    /** Per-session challenge after login. */
    public function challenge(MfaCodeRequest $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->mfa->isEnabled($user)) {
            return ApiResponse::error('Two-factor authentication is not enabled.', 409, 'mfa_not_enabled');
        }

        $valid = $request->filled('recovery_code')
            ? $this->mfa->consumeRecoveryCode($user, (string) $request->input('recovery_code'))
            : $this->mfa->verifyCode($user, (string) $request->input('code'));

        if (! $valid) {
            $this->audit->log('auth.mfa_failed', $user, 'user', $user->public_id);
            throw ValidationException::withMessages(['code' => ['The code is invalid or expired.']]);
        }

        $request->session()->regenerate(); // privilege step-up: new session id
        $request->session()->put('mfa_verified', true);
        $this->audit->log($request->filled('recovery_code') ? 'auth.mfa_recovery_used' : 'auth.mfa_verified', $user, 'user', $user->public_id);

        return ApiResponse::success(null, 'Verified.');
    }

    public function disable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string', 'current_password:web']]);
        $user = $request->user();

        if ($this->mfa->isRequiredFor($user)) {
            return ApiResponse::error('Two-factor authentication is mandatory for staff accounts.', 403, 'mfa_required_by_policy');
        }
        if (! $request->session()->get('mfa_verified', false) && $this->mfa->isEnabled($user)) {
            return ApiResponse::error('Two-factor verification required.', 403, 'mfa_required');
        }

        $this->mfa->disable($user);
        $this->audit->log('auth.mfa_disabled', $user, 'user', $user->public_id);

        return ApiResponse::success(null, 'Two-factor authentication disabled.');
    }
}
