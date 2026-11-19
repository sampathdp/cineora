<?php

namespace App\Http\Middleware;

use App\Services\Auth\MfaService;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Gate for privileged (admin) routes: enforces MFA enrolment and a per-session MFA challenge. */
class EnsureMfa
{
    public function __construct(private readonly MfaService $mfa) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return ApiResponse::error('Authentication required.', 401, 'unauthenticated');
        }

        if ($this->mfa->isEnabled($user)) {
            if (! $request->session()->get('mfa_verified', false)) {
                return ApiResponse::error('Two-factor verification required.', 403, 'mfa_required');
            }
        } elseif ($this->mfa->isRequiredFor($user)) {
            return ApiResponse::error('Two-factor setup required before using this area.', 403, 'mfa_setup_required');
        }

        return $next($request);
    }
}
