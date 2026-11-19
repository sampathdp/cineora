<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_profiles', function (Blueprint $t) {
            $t->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $t->string('phone', 32)->nullable();
            $t->date('date_of_birth')->nullable();
            $t->boolean('marketing_opt_in')->default(false);
            $t->string('locale', 8)->default('en');
            $t->timestamps();
        });

        Schema::create('roles', function (Blueprint $t) {
            $t->id();
            $t->string('key', 64)->unique();
            $t->string('name');
            $t->boolean('is_system')->default(false);
            $t->timestamps();
        });

        Schema::create('permissions', function (Blueprint $t) {
            $t->id();
            $t->string('key', 96)->unique();
            $t->string('group', 64)->index();
            $t->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $t) {
            $t->foreignId('role_id')->constrained()->cascadeOnDelete();
            $t->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $t->primary(['role_id', 'permission_id']);
        });

        Schema::create('user_roles', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('role_id')->constrained()->cascadeOnDelete();
            $t->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->primary(['user_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('customer_profiles');
    }
};
