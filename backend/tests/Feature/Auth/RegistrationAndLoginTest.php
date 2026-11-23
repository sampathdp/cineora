<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\AccountExistsNotification;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

class RegistrationAndLoginTest extends AuthTestCase
{
    private function payload(array $over = []): array
    {
        return array_merge([
            'name' => 'Min Jun', 'email' => 'minjun@example.test',
            'password' => 'Str0ngPass99', 'password_confirmation' => 'Str0ngPass99', 'terms' => true,
        ], $over);
    }

    public function test_registration_creates_a_customer_and_sends_verification(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', $this->payload())
            ->assertStatus(202)->assertJson(['success' => true]);

        $user = User::where('email', 'minjun@example.test')->firstOrFail();
        $this->assertTrue($user->hasRole(Role::Customer));
        $this->assertFalse($user->isStaff());
        $this->assertNull($user->email_verified_at);
        $this->assertNotSame('Str0ngPass99', $user->password);
        Notification::assertSentTo($user, EmailOtpNotification::class);
        $this->assertSame(1, AuditLog::where('action', 'auth.register')->count());
    }

    public function test_duplicate_registration_is_indistinguishable_and_does_not_touch_the_account(): void
    {
        Notification::fake();
        $existing = $this->customer(['email' => 'minjun@example.test', 'name' => 'Original']);

        $first = $this->postJson('/api/v1/auth/register', $this->payload(['name' => 'Attacker']));
        $first->assertStatus(202);

        $fresh = $this->postJson('/api/v1/auth/register', $this->payload(['email' => 'other@example.test']));
        $this->assertSame($fresh->json('message'), $first->json('message'));
        $this->assertSame($fresh->status(), $first->status());

        $this->assertSame('Original', $existing->fresh()->name);
        Notification::assertSentOnDemand(AccountExistsNotification::class);
        $this->assertSame(1, User::where('email', 'minjun@example.test')->count());
    }

    public function test_registration_validation_and_mass_assignment(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload(['password' => 'short', 'password_confirmation' => 'short']))
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/auth/register', $this->payload(['terms' => false]))->assertStatus(422);

        Notification::fake();
        $this->postJson('/api/v1/auth/register', $this->payload(['role' => 'super_admin', 'is_active' => false, 'roles' => ['super_admin'], 'email_verified_at' => now()->toDateTimeString()]))
            ->assertStatus(202);
        $user = User::where('email', 'minjun@example.test')->firstOrFail();
        $this->assertFalse($user->isSuperAdmin());
        $this->assertTrue($user->is_active);
        $this->assertNull($user->email_verified_at);
        $this->assertSame(['customer'], $user->roleKeys()->all());
    }

    public function test_login_success_returns_user_without_secrets_and_audits(): void
    {
        $user = $this->customer(['email' => 'a@example.test']);

        $r = $this->postJson('/api/v1/auth/login', ['email' => 'A@Example.test', 'password' => self::PASSWORD]);

        $r->assertOk()->assertJsonPath('data.user.email', 'a@example.test')->assertJsonPath('data.mfa_required', false);
        $this->assertStringNotContainsString('password', json_encode($r->json('data.user')));
        $this->assertStringNotContainsString('mfa_secret', $r->getContent());
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertSame(1, AuditLog::where('action', 'auth.login')->where('actor_id', $user->id)->count());

        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->public_id);
    }

    public function test_login_failures_are_identical_for_unknown_wrong_password_and_inactive(): void
    {
        $this->customer(['email' => 'real@example.test']);
        $this->customer(['email' => 'off@example.test', 'is_active' => false]);

        $responses = [
            $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.test', 'password' => 'Whatever123']),
            $this->postJson('/api/v1/auth/login', ['email' => 'real@example.test', 'password' => 'WrongPass123']),
            $this->postJson('/api/v1/auth/login', ['email' => 'off@example.test', 'password' => self::PASSWORD]),
        ];

        foreach ($responses as $r) {
            $r->assertStatus(422);
            $this->assertSame($responses[0]->json(), $r->json());
        }
        $this->assertSame(3, AuditLog::where('action', 'auth.login_failed')->count());
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_login_is_rate_limited_per_email_and_ip(): void
    {
        RateLimiter::clear('x');
        $this->customer(['email' => 'rl@example.test']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'rl@example.test', 'password' => 'bad-password'])->assertStatus(422);
        }
        // Even the correct password is refused once the bucket is exhausted.
        $this->postJson('/api/v1/auth/login', ['email' => 'rl@example.test', 'password' => self::PASSWORD])
            ->assertStatus(429)->assertJson(['success' => false, 'code' => 'http_429']);
    }

    public function test_staff_portal_rejects_customers_and_accepts_staff(): void
    {
        $this->customer(['email' => 'c@example.test']);
        $this->staff(Role::PaymentVerifier, ['email' => 's@example.test']);

        $this->postJson('/api/v1/auth/staff/login', ['email' => 'c@example.test', 'password' => self::PASSWORD])->assertStatus(422);
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();

        $this->newRequestCycle();
        $this->postJson('/api/v1/auth/staff/login', ['email' => 's@example.test', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('data.user.is_staff', true);
    }

    public function test_me_requires_authentication_and_exposes_permissions_for_ux_only(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertJson(['code' => 'unauthenticated']);

        $verifier = $this->staff();
        $this->as($verifier)->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('data.is_staff', true)
            ->assertJsonFragment(['payments.verify']);
    }

    public function test_logout_ends_the_session(): void
    {
        $user = $this->customer(['email' => 'lo@example.test']);
        $this->postJson('/api/v1/auth/login', ['email' => 'lo@example.test', 'password' => self::PASSWORD])->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->newRequestCycle();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertSame(1, AuditLog::where('action', 'auth.logout')->where('actor_id', $user->id)->count());
    }

    public function test_login_regenerates_the_session_id(): void
    {
        $this->customer(['email' => 'fx@example.test']);
        $before = $this->app['session.store']->getId();

        $this->postJson('/api/v1/auth/login', ['email' => 'fx@example.test', 'password' => self::PASSWORD])->assertOk();

        $this->assertNotSame($before, $this->app['session.store']->getId());
    }
}
