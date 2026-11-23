<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;

class PasswordAndVerificationTest extends AuthTestCase
{
    public function test_forgot_password_answers_the_same_for_known_and_unknown_emails(): void
    {
        Notification::fake();
        $user = $this->customer(['email' => 'f@example.test']);

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'f@example.test']);
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.test']);

        $known->assertOk();
        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentTo($user, ResetPassword::class, function ($n) use ($user) {

            return str_starts_with(ResetPassword::$createUrlCallback ? (ResetPassword::$createUrlCallback)($user, $n->token) : '', 'http://localhost:3000/reset-password?token=');
        });
        Notification::assertCount(1);
    }

    public function test_password_can_be_reset_once_and_kills_existing_sessions(): void
    {
        $user = $this->customer(['email' => 'r@example.test']);
        DB::table('sessions')->insert(['id' => 'old-session', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'r@example.test', 'password' => 'N3wStrongPass1', 'password_confirmation' => 'N3wStrongPass1',
        ])->assertOk();

        $this->assertTrue(Hash::check('N3wStrongPass1', $user->fresh()->password));
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());

        // The token is single-use.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'r@example.test', 'password' => 'An0therStrong1', 'password_confirmation' => 'An0therStrong1',
        ])->assertStatus(422);
    }

    public function test_reset_rejects_bad_tokens_and_weak_passwords(): void
    {
        $user = $this->customer(['email' => 'r2@example.test']);
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'nope', 'email' => 'r2@example.test', 'password' => 'N3wStrongPass1', 'password_confirmation' => 'N3wStrongPass1',
        ])->assertStatus(422);
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => Password::createToken($user), 'email' => 'r2@example.test', 'password' => 'weak', 'password_confirmation' => 'weak',
        ])->assertStatus(422);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->fresh()->password));
    }

    public function test_change_password_requires_current_password_and_drops_other_sessions(): void
    {
        $user = $this->customer();
        DB::table('sessions')->insert(['id' => 'other-device', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);

        $this->as($user)->postJson('/api/v1/auth/password/change', [
            'current_password' => 'wrong', 'password' => 'N3wStrongPass1', 'password_confirmation' => 'N3wStrongPass1',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->postJson('/api/v1/auth/password/change', [
            'current_password' => self::PASSWORD, 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertStatus(422); // must differ

        $this->postJson('/api/v1/auth/password/change', [
            'current_password' => self::PASSWORD, 'password' => 'N3wStrongPass1', 'password_confirmation' => 'N3wStrongPass1',
        ])->assertOk();

        $this->assertTrue(Hash::check('N3wStrongPass1', $user->fresh()->password));
        $this->assertSame(0, DB::table('sessions')->where('id', 'other-device')->count());
    }

    private function sentCode(User $user): string
    {
        $code = null;
        Notification::assertSentTo($user, EmailOtpNotification::class, function ($n) use (&$code) {
            $code = $n->code;

            return true;
        });

        return $code;
    }

    public function test_emailed_code_verifies_the_address_once(): void
    {
        Notification::fake();
        $user = $this->customer(['email_verified_at' => null]);
        $user->sendEmailVerificationNotification();
        $code = $this->sentCode($user);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);

        $this->postJson('/api/v1/auth/email/verify-code', ['email' => strtoupper($user->email), 'code' => $code])->assertOk();
        $this->assertTrue($user->fresh()->hasVerifiedEmail());

        // single use
        $this->postJson('/api/v1/auth/email/verify-code', ['email' => $user->email, 'code' => $code])->assertStatus(422);
    }

    public function test_wrong_codes_are_rejected_and_five_misses_burn_the_code(): void
    {
        Notification::fake();
        $user = $this->customer(['email_verified_at' => null]);
        $user->sendEmailVerificationNotification();
        $code = $this->sentCode($user);
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/email/verify-code', ['email' => $user->email, 'code' => $wrong])
                ->assertStatus(422)->assertJsonPath('code', 'invalid_code');
        }
        $this->postJson('/api/v1/auth/email/verify-code', ['email' => $user->email, 'code' => $code])->assertStatus(422);
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_unknown_email_looks_the_same_as_a_wrong_code(): void
    {
        Notification::fake();
        $user = $this->customer(['email_verified_at' => null]);
        $known = $this->postJson('/api/v1/auth/email/verify-code', ['email' => $user->email, 'code' => '123456']);
        $unknown = $this->postJson('/api/v1/auth/email/verify-code', ['email' => 'ghost@example.test', 'code' => '123456']);
        $this->assertSame($known->json(), $unknown->json());

        $a = $this->postJson('/api/v1/auth/email/send-code', ['email' => $user->email])->assertOk();
        $b = $this->postJson('/api/v1/auth/email/send-code', ['email' => 'ghost@example.test'])->assertOk();
        $this->assertSame($a->json(), $b->json());
        Notification::assertSentToTimes($user, EmailOtpNotification::class, 1);
    }

    public function test_tampered_or_mismatched_verification_links_do_not_verify(): void
    {
        $user = $this->customer(['email_verified_at' => null]);
        $signed = URL::temporarySignedRoute('auth.verify', now()->addHour(), ['user' => $user->public_id, 'hash' => sha1($user->email)]);

        $this->get($signed.'x')->assertForbidden();                                   // bad signature
        $wrongHash = URL::temporarySignedRoute('auth.verify', now()->addHour(), ['user' => $user->public_id, 'hash' => sha1('other@example.test')]);
        $this->get($wrongHash)->assertRedirect('http://localhost:3000/verify-email?status=invalid');
        $expired = URL::temporarySignedRoute('auth.verify', now()->subMinute(), ['user' => $user->public_id, 'hash' => sha1($user->email)]);
        $this->get($expired)->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_resend_verification_requires_login_and_skips_verified_users(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/email/resend')->assertUnauthorized();

        $unverified = $this->customer(['email_verified_at' => null]);
        $this->as($unverified)->postJson('/api/v1/auth/email/resend')->assertOk();
        Notification::assertSentTo($unverified, EmailOtpNotification::class);

        $verified = $this->customer();
        $this->as($verified)->postJson('/api/v1/auth/email/resend')->assertOk();
        Notification::assertNotSentTo($verified, EmailOtpNotification::class);
    }

    public function test_profile_update_cannot_change_email_roles_or_activation(): void
    {
        $user = $this->customer(['email' => 'p@example.test']);

        $this->as($user)->patchJson('/api/v1/account/profile', [
            'name' => 'New Name', 'phone' => '010-1234-5678', 'locale' => 'ko',
            'email' => 'evil@example.test', 'roles' => ['super_admin'], 'is_active' => false,
        ])->assertOk()->assertJsonPath('data.phone', '010-1234-5678')->assertJsonPath('data.locale', 'ko');

        $fresh = $user->fresh();
        $this->assertSame('New Name', $fresh->name);
        $this->assertSame('p@example.test', $fresh->email);
        $this->assertTrue($fresh->is_active);
        $this->assertFalse($fresh->isSuperAdmin());

        $this->patchJson('/api/v1/account/profile', ['phone' => '<script>'])->assertStatus(422);
    }

    public function test_account_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/account/profile')->assertUnauthorized();
        $this->getJson('/api/v1/account/sessions')->assertUnauthorized();
        $this->postJson('/api/v1/auth/password/change', [])->assertUnauthorized();
        $this->assertSame(0, User::count());
    }
}
