<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Password::defaults(function () {
            $rule = Password::min(10)->mixedCase()->numbers();

            return $this->app->isProduction() ? $rule->uncompromised() : $rule;
        });

        // Reset links point at the SPA, which then posts the token to the API.
        ResetPassword::createUrlUsing(fn (User $user, string $token) => rtrim((string) config('cineora.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset()));

        // Verification links are signed API URLs keyed by the public id (never the numeric id).
        VerifyEmail::createUrlUsing(fn (User $user) => URL::temporarySignedRoute(
            'auth.verify',
            now()->addMinutes(60),
            ['user' => $user->public_id, 'hash' => sha1($user->getEmailForVerification())],
        ));

        $this->rateLimiters();
    }

    private function rateLimiters(): void
    {
        $email = fn (Request $r) => mb_strtolower((string) $r->input('email'));

        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(5)->by('login:'.$email($r).'|'.$r->ip()),
            Limit::perMinute(30)->by('login-ip:'.$r->ip()),
        ]);
        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(10)->by('register:'.$r->ip()),
            Limit::perHour(3)->by('register-email:'.$email($r)),
        ]);
        RateLimiter::for('password-reset', fn (Request $r) => [
            Limit::perHour(5)->by('pwreset:'.$email($r).'|'.$r->ip()),
            Limit::perHour(20)->by('pwreset-ip:'.$r->ip()),
        ]);
        RateLimiter::for('mfa', fn (Request $r) => Limit::perMinute(5)->by('mfa:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('verification', fn (Request $r) => Limit::perMinute(3)->by('verify:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('otp-send', fn (Request $r) => [
            Limit::perMinute(1)->by('otp-send:'.$email($r)),
            Limit::perHour(5)->by('otp-send-email:'.$email($r)),
            Limit::perHour(20)->by('otp-send-ip:'.$r->ip()),
        ]);
        RateLimiter::for('otp-verify', fn (Request $r) => [
            Limit::perMinute(10)->by('otp-verify:'.$email($r).'|'.$r->ip()),
            Limit::perHour(60)->by('otp-verify-ip:'.$r->ip()),
        ]);
        RateLimiter::for('public',fn (Request $r) => Limit::perMinute(120)->by('public:'.$r->ip()));
        RateLimiter::for('admin', fn (Request $r) => Limit::perMinute(240)->by('admin:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('booking', fn (Request $r) => Limit::perMinute(10)->by('booking:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('proof', fn (Request $r) => Limit::perMinute((int) config('cineora.limits.proof_per_minute'))->by('proof:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('scanner', fn (Request $r) => Limit::perMinute(120)->by('scanner:'.($r->user()?->getKey() ?? $r->ip())));
        RateLimiter::for('contact', fn (Request $r) => Limit::perHour((int) config('cineora.limits.contact_per_hour'))->by('contact:'.$r->ip()));
        RateLimiter::for('account', fn (Request $r) => Limit::perMinute(30)->by('account:'.($r->user()?->getKey() ?? $r->ip())));
    }
}
