<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Auth\EmailOtpService;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit, private readonly EmailOtpService $otp) {}

    /** Target of the signed link in the email. Always redirects to the configured frontend (never to a request-supplied URL). */
    public function verify(Request $request, User $user, string $hash): RedirectResponse
    {
        $frontend = rtrim((string) config('cineora.frontend_url'), '/').'/verify-email';

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect()->away($frontend.'?status=invalid');
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
            $this->audit->log('auth.email_verified', $user, 'user', $user->public_id);
        }

        return redirect()->away($frontend.'?status=success');
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return ApiResponse::success(null, 'If your email is not yet verified, a new code has been sent.');
    }

    /** Public resend by email. Same answer whether or not the address exists or is already verified. */
    public function sendCode(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);
        $user = User::where('email', mb_strtolower(trim($data['email'])))->first();
        if ($user && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return ApiResponse::success(null, 'If this email needs verifying, a new code has been sent.');
    }

    /** Checks the six-digit code. Wrong code, unknown email and expired code all get the same answer. */
    public function verifyCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'code' => ['required', 'string', 'regex:/^\s*\d{6}\s*$/'],
        ]);
        $email = mb_strtolower(trim($data['email']));
        $user = User::where('email', $email)->first();

        if (! $user || ! $this->otp->check($email, $data['code'])) {
            return ApiResponse::error('That code is not valid or has expired.', 422, 'invalid_code');
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
            $this->audit->log('auth.email_verified', $user, 'user', $user->public_id);
        }

        return ApiResponse::success(null, 'Email verified.');
    }
}
