<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('slug')->unique();
            $t->string('title');
            $t->text('body')->nullable();
            $t->string('image_path')->nullable();
            $t->foreignId('cinema_id')->nullable()->constrained()->nullOnDelete();
            $t->dateTime('starts_at')->nullable();
            $t->dateTime('ends_at')->nullable();
            $t->string('status', 16)->default('draft');
            $t->dateTime('scheduled_at')->nullable();
            $t->dateTime('published_at')->nullable();
            $t->boolean('is_featured')->default(false);
            $t->string('seo_title')->nullable();
            $t->string('seo_description', 320)->nullable();
            $t->timestamps();
            $t->index(['status', 'scheduled_at']);
        });

        Schema::create('article_categories', function (Blueprint $t) {
            $t->id();
            $t->string('slug', 96)->unique();
            $t->string('name', 96);
        });

        Schema::create('articles', function (Blueprint $t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('slug')->unique();
            $t->foreignId('category_id')->nullable()->constrained('article_categories')->nullOnDelete();
            $t->string('title');
            $t->string('excerpt', 500)->nullable();
            $t->longText('body')->nullable();
            $t->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('image_path')->nullable();
            $t->string('status', 16)->default('draft');
            $t->dateTime('scheduled_at')->nullable();
            $t->dateTime('published_at')->nullable();
            $t->boolean('is_featured')->default(false);
            $t->string('seo_title')->nullable();
            $t->string('seo_description', 320)->nullable();
            $t->timestamps();
            $t->index(['status', 'scheduled_at']);
        });

        Schema::create('testimonials', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('title')->nullable();
            $t->text('quote');
            $t->unsignedTinyInteger('rating')->default(5);
            $t->boolean('is_published')->default(false);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('site_settings', function (Blueprint $t) {
            $t->id();
            $t->string('key', 96)->unique();
            $t->json('value')->nullable();
            $t->boolean('is_public')->default(false);
            $t->timestamps();
        });

        Schema::create('site_content', function (Blueprint $t) {
            $t->id();
            $t->string('key', 96);
            $t->string('locale', 8)->default('en');
            $t->longText('body')->nullable();
            $t->timestamps();
            $t->unique(['key', 'locale']);
        });

        Schema::create('social_links', function (Blueprint $t) {
            $t->id();
            $t->string('platform', 32);
            $t->string('url', 512);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('contact_messages', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email');
            $t->string('subject')->nullable();
            $t->text('message');
            $t->char('ip_hash', 64)->nullable();
            $t->string('status', 16)->default('new');
            $t->timestamps();
        });

        Schema::create('newsletter_subscribers', function (Blueprint $t) {
            $t->id();
            $t->string('email')->unique();
            $t->char('token_hash', 64)->nullable();
            $t->dateTime('confirmed_at')->nullable();
            $t->dateTime('unsubscribed_at')->nullable();
            $t->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 96);
            $t->string('resource_type', 64)->nullable();
            $t->string('resource_id', 64)->nullable();
            $t->json('metadata')->nullable(); // allow-listed, non-sensitive
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 255)->nullable();
            $t->string('correlation_id', 64)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['resource_type', 'resource_id']);
            $t->index(['actor_id', 'created_at']);
            $t->index(['action', 'created_at']);
        });

        Schema::create('notifications', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('type');
            $t->morphs('notifiable');
            $t->text('data');
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
        });

        Schema::create('notification_attempts', function (Blueprint $t) {
            $t->id();
            $t->string('notification_ref', 64)->index();
            $t->string('channel', 32);
            $t->string('status', 16);
            $t->string('error_summary', 255)->nullable();
            $t->timestamp('attempted_at')->useCurrent();
        });

        Schema::create('outbox_messages', function (Blueprint $t) {
            $t->id();
            $t->string('type', 96);
            $t->json('payload');
            $t->string('status', 16)->default('pending'); // pending|sent|failed
            $t->dateTime('available_at');
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->string('last_error', 255)->nullable();
            $t->timestamps();
            $t->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        foreach (['outbox_messages', 'notification_attempts', 'notifications', 'audit_logs', 'newsletter_subscribers', 'contact_messages', 'social_links', 'site_content', 'site_settings', 'testimonials', 'articles', 'article_categories', 'events'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
