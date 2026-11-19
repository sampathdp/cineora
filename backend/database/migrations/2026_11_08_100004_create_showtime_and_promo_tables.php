<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('showtimes', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('movie_id')->constrained()->restrictOnDelete();
            $t->unsignedBigInteger('cinema_id');
            $t->unsignedBigInteger('room_id');
            $t->dateTime('starts_at');
            $t->dateTime('ends_at'); // start + duration + buffer, computed server-side
            $t->string('status', 16)->default('draft'); // draft|on_sale|cancelled|completed
            $t->unsignedSmallInteger('sales_cutoff_minutes')->default(15);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            // Room must belong to the stated cinema.
            $t->foreign(['room_id', 'cinema_id'])->references(['id', 'cinema_id'])->on('screening_rooms')->restrictOnDelete();
            $t->foreign('cinema_id')->references('id')->on('cinemas')->restrictOnDelete();
            $t->unique(['room_id', 'starts_at']);
            $t->index(['movie_id', 'starts_at']);
            $t->index(['cinema_id', 'starts_at']);
            $t->index(['status', 'starts_at']);
        });

        Schema::create('showtime_seat_prices', function (Blueprint $t) {
            $t->foreignId('showtime_id')->constrained()->cascadeOnDelete();
            $t->foreignId('seat_category_id')->constrained('seat_categories')->restrictOnDelete();
            $t->decimal('price', 12, 2);
            $t->timestamps();
            $t->primary(['showtime_id', 'seat_category_id']);
        });

        // Per-showtime seat inventory: the lock target for booking creation.
        Schema::create('showtime_seats', function (Blueprint $t) {
            $t->id();
            $t->foreignId('showtime_id')->constrained()->cascadeOnDelete();
            $t->foreignId('seat_id')->constrained()->restrictOnDelete();
            $t->decimal('price', 12, 2);
            $t->string('status', 16)->default('available'); // available|held|sold|blocked
            $t->unsignedBigInteger('booking_id')->nullable();
            $t->dateTime('hold_expires_at')->nullable();
            $t->timestamps();
            $t->unique(['showtime_id', 'seat_id']);
            $t->index(['showtime_id', 'status']);
            $t->index(['status', 'hold_expires_at']);
        });

        Schema::create('promo_codes', function (Blueprint $t) {
            $t->id();
            $t->string('code', 48)->unique();
            $t->string('type', 16); // fixed|percent
            $t->decimal('value', 12, 2);
            $t->decimal('min_amount', 12, 2)->default(0);
            $t->decimal('max_discount', 12, 2)->nullable();
            $t->dateTime('starts_at')->nullable();
            $t->dateTime('ends_at')->nullable();
            $t->unsignedInteger('usage_limit')->nullable();
            $t->unsignedInteger('per_user_limit')->nullable();
            $t->unsignedInteger('used_count')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('promo_code_movies', function (Blueprint $t) {
            $t->foreignId('promo_code_id')->constrained()->cascadeOnDelete();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->primary(['promo_code_id', 'movie_id']);
        });

        Schema::create('promo_code_cinemas', function (Blueprint $t) {
            $t->foreignId('promo_code_id')->constrained()->cascadeOnDelete();
            $t->foreignId('cinema_id')->constrained()->cascadeOnDelete();
            $t->primary(['promo_code_id', 'cinema_id']);
        });
    }

    public function down(): void
    {
        foreach (['promo_code_cinemas', 'promo_code_movies', 'promo_codes', 'showtime_seats', 'showtime_seat_prices', 'showtimes'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
