<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movies', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('slug')->unique();
            $t->string('title');
            $t->string('tagline')->nullable();
            $t->text('description')->nullable();
            $t->unsignedSmallInteger('duration_min');
            $t->date('release_date')->nullable();
            $t->string('age_rating', 16)->nullable();
            $t->string('original_language', 8)->nullable();
            $t->string('poster_path')->nullable();
            $t->string('banner_path')->nullable();
            $t->string('trailer_url', 512)->nullable();
            $t->decimal('rating', 3, 1)->nullable();
            $t->string('status', 16)->default('draft');            // draft|published|archived
            $t->string('screening_status', 16)->default('coming_soon'); // now_playing|coming_soon
            $t->boolean('is_featured')->default(false);
            $t->string('seo_title')->nullable();
            $t->string('seo_description', 320)->nullable();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index(['status', 'screening_status', 'release_date']);
        });

        Schema::create('genres', function (Blueprint $t) {
            $t->id();
            $t->string('slug', 64)->unique();
            $t->string('name', 64);
        });

        Schema::create('movie_genres', function (Blueprint $t) {
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->foreignId('genre_id')->constrained()->cascadeOnDelete();
            $t->primary(['movie_id', 'genre_id']);
        });

        Schema::create('movie_cast', function (Blueprint $t) {
            $t->id();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->string('person_name');
            $t->string('character_name')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('movie_crew', function (Blueprint $t) {
            $t->id();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->string('person_name');
            $t->string('job', 64); // director, writer, ...
            $t->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('movie_images', function (Blueprint $t) {
            $t->id();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->string('path');
            $t->string('kind', 32)->default('still');
            $t->string('alt')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('movie_trailers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->string('url', 512);
            $t->string('title')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('movie_languages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('movie_id')->constrained()->cascadeOnDelete();
            $t->string('language_code', 8);
            $t->string('kind', 16); // audio|subtitle
            $t->unique(['movie_id', 'language_code', 'kind']);
        });
    }

    public function down(): void
    {
        foreach (['movie_languages', 'movie_trailers', 'movie_images', 'movie_crew', 'movie_cast', 'movie_genres', 'genres', 'movies'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
