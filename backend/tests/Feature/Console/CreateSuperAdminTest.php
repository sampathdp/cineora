<?php

namespace Tests\Feature\Console;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateSuperAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_a_super_admin_with_a_hashed_password(): void
    {
        $this->artisan('cineora:create-super-admin', ['--email' => 'root@example.test', '--name' => 'Root'])
            ->expectsQuestion('Password (min 12 chars, mixed case, numbers, symbols)', 'Str0ng!Passw0rd#1')
            ->expectsQuestion('Confirm password', 'Str0ng!Passw0rd#1')
            ->assertSuccessful();

        $user = User::where('email', 'root@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('Str0ng!Passw0rd#1', $user->password));
        $this->assertNotSame('Str0ng!Passw0rd#1', $user->password);
        $this->assertTrue($user->isSuperAdmin());
        $this->assertTrue($user->is_active);
    }

    public function test_rejects_weak_passwords_and_mismatches(): void
    {
        $this->artisan('cineora:create-super-admin', ['--email' => 'a@example.test', '--name' => 'A'])
            ->expectsQuestion('Password (min 12 chars, mixed case, numbers, symbols)', 'password')
            ->expectsQuestion('Confirm password', 'password')
            ->assertFailed();

        // 11 characters with every character class: still too short for a super admin.
        $this->artisan('cineora:create-super-admin', ['--email' => 'a@example.test', '--name' => 'A'])
            ->expectsQuestion('Password (min 12 chars, mixed case, numbers, symbols)', 'Sh0rt!Pa#1x')
            ->expectsQuestion('Confirm password', 'Sh0rt!Pa#1x')
            ->assertFailed();

        $this->artisan('cineora:create-super-admin', ['--email' => 'a@example.test', '--name' => 'A'])
            ->expectsQuestion('Password (min 12 chars, mixed case, numbers, symbols)', 'Str0ng!Passw0rd#1')
            ->expectsQuestion('Confirm password', 'Different!Passw0rd#2')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_seeding_never_creates_users(): void
    {
        $this->seed();
        $this->assertSame(0, User::count());
        $this->assertTrue(\App\Models\AccessRole::where('key', Role::SuperAdmin->value)->exists());
    }
}
