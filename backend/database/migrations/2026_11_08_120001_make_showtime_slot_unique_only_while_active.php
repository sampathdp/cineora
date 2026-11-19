<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A cancelled showtime must not block re-using its time slot. `slot_key` is 1 for live showtimes and NULL
     * for cancelled ones; MySQL treats NULLs as distinct in a unique index, so only live showtimes collide.
     */
    public function up(): void
    {
        Schema::table('showtimes', function (Blueprint $t) {
            $t->dropUnique(['room_id', 'starts_at']);
            $t->unsignedTinyInteger('slot_key')->nullable()->storedAs("IF(`status` = 'cancelled', NULL, 1)");
            $t->unique(['room_id', 'starts_at', 'slot_key'], 'showtimes_live_slot_unique');
        });
    }

    public function down(): void
    {
        Schema::table('showtimes', function (Blueprint $t) {
            $t->dropUnique('showtimes_live_slot_unique');
            $t->dropColumn('slot_key');
            $t->unique(['room_id', 'starts_at']);
        });
    }
};
