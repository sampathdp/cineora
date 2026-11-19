<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Decorative fallback artwork (gradient colours + motif) used by the site design when no image is uploaded.
        Schema::table('movies', fn (Blueprint $t) => $t->json('art_theme')->nullable()->after('banner_path'));
        Schema::table('cinemas', fn (Blueprint $t) => $t->json('art_theme')->nullable()->after('description'));
    }

    public function down(): void
    {
        Schema::table('movies', fn (Blueprint $t) => $t->dropColumn('art_theme'));
        Schema::table('cinemas', fn (Blueprint $t) => $t->dropColumn('art_theme'));
    }
};
