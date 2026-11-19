<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The QR needs the raw token to be drawn again later, so it is kept encrypted (application key) next to the
     * SHA-256 hash that is used for lookup. The raw value is only ever returned to the ticket's owner.
     */
    public function up(): void
    {
        Schema::table('tickets', fn (Blueprint $t) => $t->text('qr_token_encrypted')->nullable()->after('token_hash'));
        Schema::table('payments', fn (Blueprint $t) => $t->dateTime('exception_at')->nullable()->after('verified_at'));
    }

    public function down(): void
    {
        Schema::table('tickets', fn (Blueprint $t) => $t->dropColumn('qr_token_encrypted'));
        Schema::table('payments', fn (Blueprint $t) => $t->dropColumn('exception_at'));
    }
};
