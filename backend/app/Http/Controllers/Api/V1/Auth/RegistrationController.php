<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\AccessRole;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Notifications\AccountExistsNotification;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class RegistrationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Enumeration-resistant: the response is identical whether or not the email is already registered.
     * New accounts get a verification email; existing ones get an "account exists" notice.
     */
    public function store(RegisterRequest $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->string('email')->toString()));
        $generic = ApiResponse::success(null, 'If this email can be registered, we have sent you a message with the next steps.', status: 202);

        if (User::withTrashed()->where('email', $email)->exists()) {
            Notification::route('mail', $email)->notify(new AccountExistsNotification);
            $this->audit->log('auth.register_duplicate', null, null, null, ['email_fp' => AuditLogger::fingerprint($email)]);

            return $generic;
        }

        $user = DB::transaction(function () use ($request, $email) {
            $user = new User(['name' => $request->input('name'), 'email' => $email, 'password' => $request->input('password')]);
            $user->is_active = true;
            $user->save();
            CustomerProfile::create(['user_id' => $user->id, 'phone' => $request->input('phone')]);
            $user->roles()->attach(AccessRole::where('key', Role::Customer->value)->value('id'));

            return $user;
        });

        $this->audit->log('auth.register', $user, 'user', $user->public_id);
        event(new Registered($user)); // sends the verification email

        return $generic;
    }
}
