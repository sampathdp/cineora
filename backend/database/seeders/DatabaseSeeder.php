<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Roles, permissions and lookup data only. No accounts are created here; see `php artisan cineora:create-super-admin`. */
    public function run(): void
    {
        $this->call([RolePermissionSeeder::class, ReferenceDataSeeder::class]);

        if (app()->environment('local')) {
            $this->call(DemoCatalogSeeder::class);
        }
    }
}
