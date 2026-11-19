<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink(['email' => mb_strtolower(trim($request->input('email')))]);

        // Same answer whether or not the account exists.
        return ApiResponse::success(null, 'If an account exists for that email, a reset link has been sent.');
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            [...$request->only('token', 'password', 'password_confirmation'), 'email' => mb_strtolower(trim($request->input('email')))],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                // A reset invalidates every existing session for the account.
                DB::table('sessions')->where('user_id', $user->getKey())->delete();
                $this->audit->log('auth.password_reset', $user, 'user', $user->public_id);
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => ['This password reset link is invalid or has expired.']]);
        }

        return ApiResponse::success(null, 'Your password has been reset. You can now sign in.');
    }

    public function change(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['password' => $request->input('password'), 'remember_token' => Str::random(60)])->save();

        // Sign out every other device; keep this one.
        DB::table('sessions')->where('user_id', $user->getKey())->where('id', '!=', $request->session()->getId())->delete();
        $request->session()->regenerate();
        $this->audit->log('auth.password_changed', $user, 'user', $user->public_id);

        return ApiResponse::success(null, 'Password updated.');
    }
}
