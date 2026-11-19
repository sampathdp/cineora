<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('reference', 16)->unique();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('showtime_id')->constrained()->restrictOnDelete();
            $t->foreignId('cinema_id')->constrained()->restrictOnDelete();
            $t->foreignId('movie_id')->constrained()->restrictOnDelete();
            $t->string('status', 32)->default('PENDING_PAYMENT');
            $t->decimal('subtotal', 12, 2);
            $t->decimal('discount', 12, 2)->default(0);
            $t->decimal('fee', 12, 2)->default(0);
            $t->decimal('total', 12, 2);
            $t->char('currency', 3);
            $t->foreignId('promo_code_id')->nullable()->constrained()->nullOnDelete();
            $t->dateTime('hold_expires_at');
            $t->dateTime('payment_deadline_at');
            $t->dateTime('confirmed_at')->nullable();
            $t->dateTime('cancelled_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'created_at']);
            $t->index(['status', 'payment_deadline_at']);
            $t->index(['showtime_id', 'status']);
        });

        Schema::table('showtime_seats', function (Blueprint $t) {
            $t->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
        });

        Schema::create('booking_seats', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->foreignId('showtime_id')->constrained()->restrictOnDelete();
            $t->foreignId('showtime_seat_id')->constrained('showtime_seats')->restrictOnDelete();
            $t->foreignId('seat_id')->constrained()->restrictOnDelete();
            $t->string('seat_label', 16);
            $t->string('category_name', 96);
            $t->decimal('unit_price', 12, 2); // price snapshot
            $t->dateTime('released_at')->nullable();
            // 1 while the allocation is live, NULL once released: UNIQUE then forbids two live allocations of one seat.
            $t->unsignedTinyInteger('active_key')->nullable()->storedAs('IF(`released_at` IS NULL, 1, NULL)');
            $t->timestamps();
            $t->unique(['showtime_seat_id', 'active_key']);
        });

        Schema::create('seat_holds', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->foreignId('showtime_seat_id')->constrained('showtime_seats')->restrictOnDelete();
            $t->dateTime('expires_at');
            $t->dateTime('released_at')->nullable();
            $t->unsignedTinyInteger('active_key')->nullable()->storedAs('IF(`released_at` IS NULL, 1, NULL)');
            $t->timestamps();
            $t->unique(['showtime_seat_id', 'active_key']);
            $t->index(['expires_at', 'released_at']);
        });

        Schema::create('booking_status_histories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->string('from_status', 32)->nullable();
            $t->string('to_status', 32);
            $t->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('reason')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['booking_id', 'created_at']);
        });

        Schema::create('booking_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->string('type', 64);
            $t->json('payload')->nullable();
            $t->timestamp('created_at')->useCurrent();
        });

        Schema::create('idempotency_keys', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('key', 80);
            $t->char('request_hash', 64);
            $t->string('resource_type', 48)->nullable();
            $t->unsignedBigInteger('resource_id')->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'key']);
        });

        Schema::create('promo_redemptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('promo_code_id')->constrained()->restrictOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('booking_id')->unique()->constrained()->restrictOnDelete();
            $t->decimal('amount', 12, 2);
            $t->timestamps();
            $t->index(['promo_code_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promo_redemptions');
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('booking_events');
        Schema::dropIfExists('booking_status_histories');
        Schema::dropIfExists('seat_holds');
        Schema::dropIfExists('booking_seats');
        Schema::table('showtime_seats', fn (Blueprint $t) => $t->dropForeign(['booking_id']));
        Schema::dropIfExists('bookings');
    }
};
