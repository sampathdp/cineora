<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cinemas', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('slug')->unique();
            $t->string('name');
            $t->string('area')->nullable();
            $t->string('address');
            $t->string('phone', 32)->nullable();
            $t->string('email')->nullable();
            $t->text('description')->nullable();
            $t->string('timezone', 64)->default('Asia/Seoul');
            $t->char('currency', 3)->default('KRW');
            $t->boolean('is_active')->default(true)->index();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('staff_cinema_assignments', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('cinema_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
            $t->primary(['user_id', 'cinema_id']);
        });

        Schema::create('cinema_facilities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('cinema_id')->constrained()->cascadeOnDelete();
            $t->string('name', 96);
            $t->unique(['cinema_id', 'name']);
        });

        Schema::create('cinema_images', function (Blueprint $t) {
            $t->id();
            $t->foreignId('cinema_id')->constrained()->cascadeOnDelete();
            $t->string('path');
            $t->string('alt')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('screening_rooms', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('cinema_id')->constrained()->restrictOnDelete();
            $t->string('name', 96);
            $t->string('screen_type', 64)->default('Standard');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();
            $t->unique(['cinema_id', 'name']);
            // Target for the composite FK that keeps showtimes consistent (room belongs to the cinema).
            $t->unique(['id', 'cinema_id']);
        });

        Schema::create('seat_categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('cinema_id')->nullable()->constrained()->cascadeOnDelete(); // null = global
            $t->string('key', 48);
            $t->string('name', 96);
            $t->decimal('default_price', 12, 2)->default(0);
            $t->timestamps();
            $t->unique(['cinema_id', 'key']);
        });

        Schema::create('seats', function (Blueprint $t) {
            $t->id();
            $t->foreignId('room_id')->constrained('screening_rooms')->restrictOnDelete();
            $t->string('row_label', 4);
            $t->unsignedSmallInteger('number');
            $t->foreignId('seat_category_id')->constrained('seat_categories')->restrictOnDelete();
            $t->smallInteger('x')->nullable();
            $t->smallInteger('y')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['room_id', 'row_label', 'number']);
        });
    }

    public function down(): void
    {
        foreach (['seats', 'seat_categories', 'screening_rooms', 'cinema_images', 'cinema_facilities', 'staff_cinema_assignments', 'cinemas'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
