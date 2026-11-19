<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('cinema_id')->nullable()->constrained()->restrictOnDelete(); // null = platform-wide
            $t->string('bank_name');
            $t->string('account_name');
            $t->text('account_number'); // encrypted cast
            $t->string('branch')->nullable();
            $t->string('swift', 16)->nullable();
            $t->text('instructions')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('booking_id')->constrained()->restrictOnDelete();
            $t->string('payment_reference', 48)->unique();
            $t->foreignId('bank_account_id')->constrained()->restrictOnDelete();
            $t->decimal('expected_amount', 12, 2);
            $t->decimal('submitted_amount', 12, 2)->nullable();
            $t->date('transfer_date')->nullable();
            $t->string('payer_name')->nullable();
            $t->string('status', 32)->default('AWAITING_TRANSFER');
            $t->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('submitted_at')->nullable();
            $t->dateTime('verified_at')->nullable();
            $t->timestamps();
            // At most one live (not rejected/expired) payment per booking.
            $t->unsignedTinyInteger('active_key')->nullable()->storedAs("IF(`status` IN ('REJECTED','EXPIRED'), NULL, 1)");
            $t->unique(['booking_id', 'active_key']);
            $t->index(['status', 'submitted_at']);
        });

        Schema::create('payment_proofs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->constrained()->restrictOnDelete();
            $t->string('disk', 32)->default('private');
            $t->string('path'); // server-generated random name
            $t->string('original_name')->nullable(); // display only, never used for storage
            $t->string('mime', 64);
            $t->unsignedInteger('size');
            $t->char('sha256', 64)->index();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        // Append-only.
        Schema::create('payment_reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->constrained()->restrictOnDelete();
            $t->foreignId('reviewer_id')->constrained('users')->restrictOnDelete();
            $t->string('decision', 16); // verified|rejected|exception
            $t->string('reason')->nullable(); // required when rejected (enforced in service)
            $t->text('internal_notes')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['payment_id', 'created_at']);
        });

        Schema::create('refund_requests', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('booking_id')->constrained()->restrictOnDelete();
            $t->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $t->string('reason', 1000);
            $t->decimal('amount', 12, 2);
            $t->string('status', 16)->default('pending'); // pending|approved|denied|paid
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('decided_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });

        Schema::create('refund_transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('refund_request_id')->constrained()->restrictOnDelete();
            $t->decimal('amount', 12, 2);
            $t->string('reference', 96)->nullable();
            $t->dateTime('paid_at');
            $t->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $t->timestamps();
        });

        Schema::create('tickets', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique(); // shown as ticket reference
            $t->foreignId('booking_id')->constrained()->restrictOnDelete();
            $t->foreignId('booking_seat_id')->unique()->constrained('booking_seats')->restrictOnDelete(); // one ticket per seat
            $t->foreignId('showtime_id')->constrained()->restrictOnDelete();
            $t->char('token_hash', 64)->unique(); // SHA-256 of the random QR token
            $t->string('status', 16)->default('valid'); // valid|used|cancelled|refunded|void
            $t->dateTime('issued_at');
            $t->dateTime('used_at')->nullable();
            $t->timestamps();
            $t->index(['showtime_id', 'status']);
        });

        Schema::create('ticket_checkins', function (Blueprint $t) {
            $t->id();
            $t->foreignId('ticket_id')->unique()->constrained()->restrictOnDelete();
            $t->foreignId('checker_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('cinema_id')->constrained()->restrictOnDelete();
            $t->dateTime('checked_in_at');
        });

        Schema::create('ticket_validation_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('ticket_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('checker_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('cinema_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('outcome', 24);
            $t->char('token_fingerprint', 8)->nullable(); // first 8 hex of the hash only
            $t->timestamp('created_at')->useCurrent();
            $t->index(['checker_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['ticket_validation_events', 'ticket_checkins', 'tickets', 'refund_transactions', 'refund_requests', 'payment_reviews', 'payment_proofs', 'payments', 'bank_accounts'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
