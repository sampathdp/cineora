<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

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

        return ApiResponse::success(null, 'If your email is not yet verified, a new link has been sent.');
    }
}
