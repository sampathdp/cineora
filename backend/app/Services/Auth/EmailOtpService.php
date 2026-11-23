<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\Cache;

/**
 * Six-digit one-time codes that prove a customer owns their email address.
 *
 * Only an HMAC of the code is cached, for 10 minutes. A code is single-use, and five wrong guesses burn it,
 * so brute force needs a fresh email each time (and the send endpoint is rate limited).
 */
class EmailOtpService
{
    public const TTL_MINUTES = 10;

    private const MAX_ATTEMPTS = 5;

    public function send(User $user): void
    {
        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);
        Cache::put($this->key($user->email), ['hash' => $this->hash($code), 'attempts' => 0], now()->addMinutes(self::TTL_MINUTES));
        $user->notify(new EmailOtpNotification($code));
    }

    /** True when the code is right; the code is consumed either way once it is right or out of attempts. */
    public function check(string $email, string $code): bool
    {
        $key = $this->key($email);
        $entry = Cache::get($key);
        if (! is_array($entry)) {
            return false;
        }

        if (hash_equals($entry['hash'], $this->hash(trim($code)))) {
            Cache::forget($key);

            return true;
        }

        $entry['attempts']++;
        $entry['attempts'] >= self::MAX_ATTEMPTS ? Cache::forget($key) : Cache::put($key, $entry, now()->addMinutes(self::TTL_MINUTES));

        return false;
    }

    private function key(string $email): string
    {
        return 'email-otp:'.hash('sha256', mb_strtolower(trim($email)));
    }

    private function hash(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }
}
