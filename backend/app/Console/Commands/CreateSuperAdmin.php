<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\AccessRole;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/** Controlled first-admin provisioning. No default or hardcoded credentials exist anywhere. */
class CreateSuperAdmin extends Command
{
    protected $signature = 'cineora:create-super-admin {--email= : Admin email} {--name= : Display name}';

    protected $description = 'Create a super admin account interactively (password is prompted, never passed as an argument)';

    public function handle(): int
    {
        $name = $this->option('name') ?: text('Name', required: true);
        $email = $this->option('email') ?: text('Email', required: true);

        $pw = password('Password (min 12 chars, mixed case, numbers, symbols)', required: true);
        if ($pw !== password('Confirm password', required: true)) {
            $this->error('Passwords do not match.');

            return self::FAILURE;
        }

        $passwordRule = Password::min(12)->mixedCase()->numbers()->symbols();
        if (app()->isProduction()) {
            $passwordRule->uncompromised();
        }

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $pw],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
                'password' => ['required', $passwordRule],
            ],
        );
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($name, $email, $pw) {
            $this->callSilently('db:seed', ['--class' => RolePermissionSeeder::class, '--force' => true]);

            $user = new User(['name' => $name, 'email' => $email, 'password' => $pw]);
            $user->is_active = true;
            $user->email_verified_at = now();
            $user->save();
            $user->roles()->attach(AccessRole::where('key', Role::SuperAdmin->value)->value('id'));

            return $user;
        });

        $this->info("Super admin created: {$user->email}");
        if (app()->isProduction()) {
            $this->warn('Production: this account must enrol TOTP MFA at first login before it can use admin features.');
        }

        return self::SUCCESS;
    }
}
