<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Http;

class GoogleLoginTest extends AuthTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['services.google.client_id' => 'test-client.apps.googleusercontent.com']);
    }

    private function fakeGoogle(array $over = []): void
    {
        Http::fake(['oauth2.googleapis.com/*' => Http::response(array_merge([
            'aud' => 'test-client.apps.googleusercontent.com',
            'iss' => 'https://accounts.google.com',
            'email' => 'Jisoo@Example.test',
            'email_verified' => 'true',
            'name' => 'Ji Soo',
            'sub' => '1234567890',
        ], $over))]);
    }

    public function test_first_google_sign_in_creates_a_verified_customer_and_signs_in(): void
    {
        $this->fakeGoogle();

        $this->postJson('/api/v1/auth/google', ['credential' => 'token'])
            ->assertOk()->assertJsonPath('data.user.email', 'jisoo@example.test');

        $user = User::where('email', 'jisoo@example.test')->firstOrFail();
        $this->assertTrue($user->hasRole(Role::Customer));
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame('Ji Soo', $user->name);
        $this->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_existing_customer_is_signed_in_without_a_duplicate(): void
    {
        $this->fakeGoogle();
        $existing = $this->customer(['email' => 'jisoo@example.test', 'email_verified_at' => null]);

        $this->postJson('/api/v1/auth/google', ['credential' => 'token'])->assertOk();

        $this->assertSame(1, User::where('email', 'jisoo@example.test')->count());
        $this->assertNotNull($existing->fresh()->email_verified_at);
    }

    public function test_staff_cannot_use_google_sign_in(): void
    {
        $this->fakeGoogle();
        $this->staff(Role::PaymentVerifier, ['email' => 'jisoo@example.test']);

        $this->postJson('/api/v1/auth/google', ['credential' => 'token'])->assertStatus(422);
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_token_for_another_client_or_unverified_email_is_rejected(): void
    {
        $this->fakeGoogle(['aud' => 'someone-else']);
        $this->postJson('/api/v1/auth/google', ['credential' => 'token'])->assertStatus(422);

        Http::swap(new \Illuminate\Http\Client\Factory);
        $this->fakeGoogle(['email_verified' => 'false']);
        $this->postJson('/api/v1/auth/google', ['credential' => 'token'])->assertStatus(422);

        $this->assertSame(0, User::where('email', 'jisoo@example.test')->count());
    }
}
