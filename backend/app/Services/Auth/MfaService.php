<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/** TOTP (RFC 6238) via an established library; no custom cryptography. */
class MfaService
{
    public function __construct(private readonly Google2FA $google2fa) {}

    public function beginEnrolment(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey(32);
        $user->forceFill(['mfa_secret' => $secret, 'mfa_confirmed_at' => null, 'mfa_recovery_codes' => null])->save();

        return [
            'secret' => $secret,
            'otpauth_uri' => $this->google2fa->getQRCodeUrl(config('app.name'), $user->email, $secret),
        ];
    }

    /** Verifies a code and rejects replay of an already-used time step. */
    public function verifyCode(User $user, string $code): bool
    {
        if (! $user->mfa_secret || ! preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        $key = 'mfa:last-step:'.$user->getKey();
        $result = $this->google2fa->verifyKeyNewer($user->mfa_secret, $code, Cache::get($key, 0), 1);
        if ($result === false) {
            return false;
        }
        Cache::put($key, $result, now()->addMinutes(5));

        return true;
    }

    /** @return list<string> plain codes, shown to the user exactly once */
    public function confirmEnrolment(User $user): array
    {
        $plain = [];
        $hashes = [];
        for ($i = 0; $i < 8; $i++) {
            $code = Str::lower(Str::random(5).'-'.Str::random(5));
            $plain[] = $code;
            $hashes[] = hash('sha256', $code);
        }
        $user->forceFill(['mfa_confirmed_at' => now(), 'mfa_recovery_codes' => $hashes])->save();

        return $plain;
    }

    public function consumeRecoveryCode(User $user, string $code): bool
    {
        $hash = hash('sha256', Str::lower(trim($code)));
        $codes = $user->mfa_recovery_codes ?? [];
        foreach ($codes as $i => $stored) {
            if (hash_equals($stored, $hash)) {
                unset($codes[$i]);
                $user->forceFill(['mfa_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }

    public function disable(User $user): void
    {
        $user->forceFill(['mfa_secret' => null, 'mfa_confirmed_at' => null, 'mfa_recovery_codes' => null])->save();
    }

    public function isEnabled(User $user): bool
    {
        return $user->mfa_confirmed_at !== null && $user->mfa_secret !== null;
    }

    /** Staff must have MFA in production (configurable); customers never need it. */
    public function isRequiredFor(User $user): bool
    {
        return $user->isStaff() && (bool) config('cineora.auth.require_staff_mfa');
    }
}
