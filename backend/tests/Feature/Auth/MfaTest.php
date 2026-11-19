<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Services\Auth\MfaService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use PragmaRX\Google2FA\Google2FA;

class MfaTest extends AuthTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Route::middleware(['api', 'auth:sanctum', 'staff', 'mfa'])->get('/api/v1/_admin_probe', fn () => response()->json(['ok' => true]));
    }

    private function enrol($staff): array
    {
        $r = $this->as($staff)->postJson('/api/v1/auth/mfa/setup', ['password' => self::PASSWORD])->assertOk();
        $secret = $r->json('data.secret');
        $code = (new Google2FA)->getCurrentOtp($secret);
        $codes = $this->postJson('/api/v1/auth/mfa/confirm', ['code' => $code])->assertOk()->json('data.recovery_codes');

        return [$secret, $codes];
    }

    public function test_setup_requires_password_and_a_staff_account(): void
    {
        $staff = $this->staff();
        $this->as($staff)->postJson('/api/v1/auth/mfa/setup', ['password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/v1/auth/mfa/setup', ['password' => self::PASSWORD])
            ->assertOk()->assertJsonStructure(['data' => ['secret', 'otpauth_uri']]);

        $this->as($this->customer())->postJson('/api/v1/auth/mfa/setup', ['password' => self::PASSWORD])->assertForbidden();
    }

    public function test_enrolment_confirms_with_a_valid_code_and_returns_hashed_recovery_codes_once(): void
    {
        $staff = $this->staff();
        [$secret, $codes] = $this->enrol($staff);

        $fresh = $staff->fresh();
        $this->assertTrue(app(MfaService::class)->isEnabled($fresh));
        $this->assertCount(8, $codes);
        $this->assertNotContains($codes[0], $fresh->mfa_recovery_codes, 'recovery codes must be stored hashed');
        $this->assertStringNotContainsString($secret, (string) \DB::table('users')->where('id', $staff->id)->value('mfa_secret'), 'secret must be encrypted at rest');
        $this->assertSame(1, AuditLog::where('action', 'auth.mfa_enabled')->count());
    }

    public function test_wrong_code_does_not_confirm(): void
    {
        $staff = $this->staff();
        $this->as($staff)->postJson('/api/v1/auth/mfa/setup', ['password' => self::PASSWORD])->assertOk();

        $this->postJson('/api/v1/auth/mfa/confirm', ['code' => '000000'])->assertStatus(422);
        $this->assertFalse(app(MfaService::class)->isEnabled($staff->fresh()));
    }

    public function test_admin_routes_need_a_per_session_challenge_once_mfa_is_enabled(): void
    {
        $staff = $this->staff();
        [$secret] = $this->enrol($staff);

        // New session: the enrolment flag is gone.
        $this->app['session.store']->flush();
        $this->as($staff->fresh())->getJson('/api/v1/_admin_probe')->assertForbidden()->assertJson(['code' => 'mfa_required']);

        Cache::flush(); // allow the same time-step again for the test
        $this->postJson('/api/v1/auth/mfa/challenge', ['code' => '123456'])->assertStatus(422);
        $this->postJson('/api/v1/auth/mfa/challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertOk();
        $this->getJson('/api/v1/_admin_probe')->assertOk();
    }

    public function test_totp_code_cannot_be_replayed(): void
    {
        $staff = $this->staff();
        [$secret] = $this->enrol($staff); // consumes the current step during confirm

        $this->app['session.store']->flush();
        $this->as($staff->fresh())->postJson('/api/v1/auth/mfa/challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])
            ->assertStatus(422);
    }

    public function test_recovery_codes_work_exactly_once(): void
    {
        $staff = $this->staff();
        [, $codes] = $this->enrol($staff);

        $this->app['session.store']->flush();
        $this->as($staff->fresh())->postJson('/api/v1/auth/mfa/challenge', ['recovery_code' => $codes[0]])->assertOk();

        $this->app['session.store']->flush();
        $this->as($staff->fresh())->postJson('/api/v1/auth/mfa/challenge', ['recovery_code' => $codes[0]])->assertStatus(422);
        $this->assertCount(7, $staff->fresh()->mfa_recovery_codes);
    }

    public function test_production_policy_blocks_unenrolled_staff_from_admin_routes_but_not_customers_from_anything_else(): void
    {
        config(['cineora.auth.require_staff_mfa' => true]);

        $this->as($this->staff())->getJson('/api/v1/_admin_probe')->assertForbidden()->assertJson(['code' => 'mfa_setup_required']);

        // /me stays reachable so the SPA can send the user to setup.
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.mfa.required', true);
    }

    public function test_mfa_cannot_be_disabled_when_policy_requires_it(): void
    {
        $staff = $this->staff();
        $this->enrol($staff);
        config(['cineora.auth.require_staff_mfa' => true]);

        $this->deleteJson('/api/v1/auth/mfa', ['password' => self::PASSWORD])->assertForbidden()->assertJson(['code' => 'mfa_required_by_policy']);
        $this->assertTrue(app(MfaService::class)->isEnabled($staff->fresh()));
    }

    public function test_unauthenticated_admin_access_is_rejected(): void
    {
        $this->getJson('/api/v1/_admin_probe')->assertUnauthorized();
        $this->as($this->customer())->getJson('/api/v1/_admin_probe')->assertForbidden();
    }
}
