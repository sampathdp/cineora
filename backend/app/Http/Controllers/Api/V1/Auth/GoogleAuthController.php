<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuthUserResource;
use App\Models\AccessRole;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Customer sign-in with a Google ID token from Google Identity Services.
 * First sign-in creates a verified customer account; staff must use the staff portal (password + MFA).
 */
class GoogleAuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function login(Request $request): JsonResponse
    {
        $request->validate(['credential' => ['required', 'string', 'max:4096']]);

        $claims = $this->verify($request->string('credential')->toString());
        $email = mb_strtolower(trim($claims['email']));

        $user = User::withTrashed()->where('email', $email)->first();

        if ($user && ($user->trashed() || ! $user->is_active || $user->isStaff())) {
            $this->audit->log('auth.google_login_failed', null, null, null, ['email_fp' => AuditLogger::fingerprint($email)]);
            throw ValidationException::withMessages(['credential' => ['This account cannot sign in with Google.']]);
        }

        $user ??= DB::transaction(function () use ($claims, $email) {
            $user = new User([
                'name' => Str::limit($claims['name'] ?? Str::before($email, '@'), 120, ''),
                'email' => $email,
                'password' => Str::random(64), // unusable; the customer can set one via "forgot password"
            ]);
            $user->is_active = true;
            $user->save();
            CustomerProfile::create(['user_id' => $user->id]);
            $user->roles()->attach(AccessRole::where('key', Role::Customer->value)->value('id'));
            $this->audit->log('auth.register_google', $user, 'user', $user->public_id);

            return $user;
        });

        // Google has verified the address, so no OTP step is needed.
        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()]);
        }
        $user->forceFill(['last_login_at' => now()])->save();

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->forget('mfa_verified');
        $this->audit->log('auth.google_login', $user, 'user', $user->public_id);

        return ApiResponse::success([
            'user' => new AuthUserResource($user),
            'mfa_required' => false,
            'mfa_setup_required' => false,
        ], 'Signed in.');
    }

    /** @return array{email: string, name?: string} */
    private function verify(string $idToken): array
    {
        $clientId = config('services.google.client_id');
        $fail = fn () => ValidationException::withMessages(['credential' => ['Google sign-in failed. Please try again.']]);

        if (! $clientId) {
            throw $fail();
        }

        // Google's tokeninfo endpoint checks the signature and expiry for us.
        $res = Http::timeout(5)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $idToken]);
        $claims = $res->ok() ? $res->json() : null;

        if (! is_array($claims)
            || ($claims['aud'] ?? null) !== $clientId
            || ! in_array($claims['iss'] ?? null, ['accounts.google.com', 'https://accounts.google.com'], true)
            || ! in_array($claims['email_verified'] ?? null, ['true', true], true)
            || empty($claims['email'])) {
            throw $fail();
        }

        return $claims;
    }
}
