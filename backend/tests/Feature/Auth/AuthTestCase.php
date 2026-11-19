<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class AuthTestCase extends TestCase
{
    use RefreshDatabase;

    public const PASSWORD = 'Sup3r-Secret-Pass';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        // Requests must look like they come from the SPA origin to get the stateful (session) pipeline.
        $this->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/']);
    }

    protected function customer(array $attrs = []): User
    {
        return User::factory()->withRole(Role::Customer)->create(array_merge(['password' => self::PASSWORD], $attrs));
    }

    protected function staff(Role $role = Role::PaymentVerifier, array $attrs = []): User
    {
        return User::factory()->withRole($role)->create(array_merge(['password' => self::PASSWORD], $attrs));
    }

    /** actingAs that survives several actors in one test (the first request pins the default guard to sanctum). */
    protected function as(User $user): static
    {
        // Session state is shared across requests in a test; a new actor means a new browser session.
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->app['auth']->shouldUse('web');

        return $this->actingAs($user, 'web');
    }

    /** Drops the cached guard user so the next request re-resolves authentication from the session. */
    protected function newRequestCycle(): void
    {
        $this->app['auth']->forgetGuards();
        $this->app['auth']->shouldUse('web');
    }
}
