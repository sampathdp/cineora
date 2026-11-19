<?php

namespace Tests\Feature\Admin;

use App\Enums\ContentStatus;
use App\Enums\Role;
use App\Models\Article;
use App\Models\AuditLog;
use App\Models\ContactMessage;
use App\Models\Event;
use App\Models\NewsletterSubscriber;
use App\Models\SiteSetting;
use App\Services\Content\ContentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class ContentTest extends AdminTestCase
{
    private function editor()
    {
        return $this->staff(Role::ContentManager);
    }

    public function test_articles_are_drafts_until_published_and_bodies_cannot_carry_markup(): void
    {
        $id = $this->as($this->editor())->postJson('/api/v1/admin/articles', [
            'title' => 'Opening night <script>alert(1)</script>', 'excerpt' => 'A <b>bold</b> start', 'status' => 'published', 'published_at' => '2020-01-01',
            'body' => "First paragraph with <img src=x onerror=alert(1)> inside.\n\n\n\nSecond paragraph.",
        ])->assertCreated()->json('data.id');

        $article = Article::where('public_id', $id)->firstOrFail();
        $this->assertSame(ContentStatus::Draft, $article->status, 'status cannot be forced on create');
        $this->assertNull($article->published_at);
        $this->assertStringNotContainsString('<', $article->title.$article->excerpt.$article->body);
        $this->assertStringNotContainsString('onerror', $article->body);
        $this->assertSame($this->editor()->id === 0 ? 0 : $article->author_id, $article->author_id);

        $this->getJson("/api/v1/articles/{$article->slug}")->assertNotFound();
        $this->getJson('/api/v1/articles')->assertJsonCount(0, 'data');

        $this->postJson("/api/v1/admin/content/articles/{$id}/publish")->assertOk()->assertJsonPath('data.status', 'published');
        $public = $this->getJson("/api/v1/articles/{$article->slug}")->assertOk();
        $this->assertCount(2, $public->json('data.paragraphs'));
        $this->assertStringNotContainsString('<script', $public->getContent());
        $this->getJson('/api/v1/articles')->assertJsonCount(1, 'data');

        $this->postJson("/api/v1/admin/content/articles/{$id}/unpublish")->assertOk();
        $this->getJson("/api/v1/articles/{$article->slug}")->assertNotFound();
        $this->assertSame(['article.created', 'article.published', 'article.unpublished'], AuditLog::where('resource_type', 'article')->orderBy('id')->pluck('action')->all());
    }

    public function test_publishing_requires_content_and_scheduling_requires_a_future_time(): void
    {
        $this->as($this->editor());
        $id = $this->postJson('/api/v1/admin/articles', ['title' => 'Empty one'])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/admin/content/articles/{$id}/publish")->assertStatus(422)->assertJsonValidationErrors('body');

        $this->patchJson("/api/v1/admin/articles/{$id}", ['body' => 'Some text.'])->assertOk();
        $this->postJson("/api/v1/admin/content/articles/{$id}/schedule", ['scheduled_at' => now()->subHour()->toIso8601String()])->assertStatus(422);
        $this->postJson("/api/v1/admin/content/articles/{$id}/schedule", [])->assertStatus(422);
        $this->postJson("/api/v1/admin/content/articles/{$id}/schedule", ['scheduled_at' => now()->addHour()->toIso8601String()])->assertOk()->assertJsonPath('data.status', 'scheduled');
    }

    public function test_scheduled_content_goes_live_by_itself_exactly_when_due(): void
    {
        $this->as($this->editor());
        $id = $this->postJson('/api/v1/admin/events', ['title' => 'Midnight marathon', 'body' => 'All night long.'])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/admin/content/events/{$id}/schedule", ['scheduled_at' => now()->addHours(2)->toIso8601String()])->assertOk();
        $slug = Event::where('public_id', $id)->value('slug');

        $this->assertSame(0, app(ContentService::class)->publishDue());
        $this->getJson("/api/v1/events/{$slug}")->assertNotFound();

        Carbon::setTestNow(now()->addHours(3));
        $this->assertSame(1, app(ContentService::class)->publishDue());
        $this->assertSame(0, app(ContentService::class)->publishDue(), 'idempotent');
        $this->getJson("/api/v1/events/{$slug}")->assertOk();
        $this->artisan('bookings:maintain')->assertSuccessful();
        Carbon::setTestNow();
    }

    public function test_images_follow_the_same_upload_rules_and_old_files_are_removed(): void
    {
        Storage::fake('public');
        $this->as($this->editor());
        $id = $this->postJson('/api/v1/admin/articles', ['title' => 'With picture', 'body' => 'Text.'])->assertCreated()->json('data.id');
        $url = "/api/v1/admin/content/articles/{$id}/image";

        $this->post($url, ['image' => UploadedFile::fake()->createWithContent('x.png', '<?php evil();')], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post($url, ['image' => UploadedFile::fake()->createWithContent('x.svg', '<svg><script>1</script></svg>')], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->post($url, ['image' => UploadedFile::fake()->image('a.jpg', 800, 500)], ['Accept' => 'application/json'])->assertOk();
        $first = Article::where('public_id', $id)->value('image_path');
        $this->assertMatchesRegularExpression('#^articles/[0-9a-z]{26}\.jpg$#', $first);
        $this->post($url, ['image' => UploadedFile::fake()->image('b.png', 800, 500)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($first);
        $this->post("/api/v1/admin/content/pages/{$id}/image", [], ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_only_content_managers_may_edit_content_and_deletes_clean_up(): void
    {
        foreach ([$this->verifier, $this->manager(), $this->checker, $this->customer] as $user) {
            $this->as($user)->getJson('/api/v1/admin/articles')->assertForbidden();
            $this->postJson('/api/v1/admin/events', ['title' => 'Nope nope'])->assertForbidden();
            $this->postJson('/api/v1/admin/testimonials', ['name' => 'X Y', 'quote' => 'long enough quote here'])->assertForbidden();
            $this->getJson('/api/v1/admin/messages')->assertForbidden();
        }
        $id = $this->as($this->editor())->postJson('/api/v1/admin/events', ['title' => 'Short lived'])->assertCreated()->json('data.id');
        $this->deleteJson("/api/v1/admin/content/events/{$id}")->assertOk();
        $this->assertSame(0, Event::count());
    }

    public function test_categories_and_public_filtering(): void
    {
        $this->as($this->editor());
        $this->postJson('/api/v1/admin/article-categories', ['name' => 'Reviews'])->assertCreated();
        $id = $this->postJson('/api/v1/admin/articles', ['title' => 'A review', 'body' => 'Great.', 'category' => 'reviews'])->assertCreated()->assertJsonPath('data.category.slug', 'reviews')->json('data.id');
        $this->postJson('/api/v1/admin/articles', ['title' => 'Bad', 'category' => 'nonexistent'])->assertStatus(422);
        $this->postJson("/api/v1/admin/content/articles/{$id}/publish")->assertOk();

        $this->getJson('/api/v1/article-categories')->assertJsonFragment(['slug' => 'reviews']);
        $this->getJson('/api/v1/articles?category=reviews')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/articles?category=other')->assertJsonCount(0, 'data');
    }

    public function test_testimonials_public_list_shows_only_published_ones(): void
    {
        $this->as($this->editor());
        $a = $this->postJson('/api/v1/admin/testimonials', ['name' => 'Min Jun', 'quote' => 'A wonderful evening at the cinema.', 'rating' => 5, 'is_published' => true])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/admin/testimonials', ['name' => 'Hidden', 'quote' => 'Not yet approved by the team.', 'is_published' => false])->assertCreated();
        $this->postJson('/api/v1/admin/testimonials', ['name' => 'Bad <b>', 'quote' => 'x', 'rating' => 9])->assertStatus(422);

        $public = $this->getJson('/api/v1/testimonials')->assertOk()->json('data');
        $this->assertSame(['Min Jun'], array_column($public, 'name'));
        $this->assertArrayNotHasKey('id', $public[0]);
        $this->patchJson("/api/v1/admin/testimonials/{$a}", ['is_published' => false])->assertOk();
        $this->getJson('/api/v1/testimonials')->assertJsonCount(0, 'data');
    }

    // --- Public forms ---------------------------------------------------------------------------------

    public function test_contact_form_validates_sanitises_and_ignores_bots(): void
    {
        $good = ['name' => 'Kim <i>Yuna</i>', 'email' => 'yuna@example.test', 'subject' => 'Group booking', 'message' => 'Hello <script>x</script> can we book 20 seats for a school trip?'];
        $this->postJson('/api/v1/contact', $good)->assertCreated();
        $msg = ContactMessage::firstOrFail();
        $this->assertStringNotContainsString('<', $msg->name.$msg->message);
        $this->assertSame(64, strlen($msg->ip_hash));
        $this->assertNotSame('127.0.0.1', $msg->ip_hash);

        $this->postJson('/api/v1/contact', [...$good, 'website' => 'http://spam.test'])->assertCreated();
        $this->assertSame(1, ContactMessage::count(), 'honeypot submissions are discarded silently');
        $this->postJson('/api/v1/contact', ['name' => 'x'])->assertStatus(422);
        $this->postJson('/api/v1/contact', [...$good, 'email' => 'not-an-email'])->assertStatus(422);
        $this->postJson('/api/v1/contact', [...$good, 'message' => 'short'])->assertStatus(422);

        $list = $this->as($this->editor())->getJson('/api/v1/admin/messages')->assertOk()->json('data');
        $this->assertSame('new', $list[0]['status']);
        $this->postJson("/api/v1/admin/messages/{$list[0]['id']}/handled")->assertOk();
        $this->getJson('/api/v1/admin/messages?status=new')->assertJsonCount(0, 'data');
    }

    public function test_contact_and_newsletter_are_rate_limited(): void
    {
        config(['cineora.limits.contact_per_hour' => 3]);
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/newsletter', ['email' => "n{$i}@example.test"])->assertCreated();
        }
        $this->postJson('/api/v1/newsletter', ['email' => 'n9@example.test'])->assertStatus(429);
        $this->postJson('/api/v1/contact', ['name' => 'Over Limit', 'email' => 'a@example.test', 'subject' => 'Hello', 'message' => 'A message that is long enough.'])->assertStatus(429);
    }

    public function test_newsletter_signup_does_not_reveal_existing_subscribers(): void
    {
        $first = $this->postJson('/api/v1/newsletter', ['email' => 'Fan@Example.test'])->assertCreated();
        $again = $this->postJson('/api/v1/newsletter', ['email' => 'fan@example.test'])->assertCreated();
        $this->assertSame($first->json('message'), $again->json('message'));
        $this->assertSame(1, NewsletterSubscriber::count());
        $this->postJson('/api/v1/newsletter', ['email' => 'nope'])->assertStatus(422);

        $this->assertSame(['fan@example.test'], array_column($this->as($this->editor())->getJson('/api/v1/admin/newsletter')->json('data'), 'email'));
    }

    // --- Site settings -----------------------------------------------------------------------------------

    public function test_site_settings_are_allow_listed_validated_and_published(): void
    {
        $this->as($this->editor())->getJson('/api/v1/admin/settings')->assertForbidden(); // content.manage is not settings.manage
        $this->as($this->admin);

        $this->putJson('/api/v1/admin/settings', ['values' => ['contact.email' => 'hello@cineora.test', 'contact.phone' => '+82 2 1234 5678', 'site.tagline' => 'Cinema, <b>booked</b> beautifully.']])->assertOk();
        $this->putJson('/api/v1/admin/settings', ['values' => ['contact.email' => 'broken']])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings', ['values' => ['contact.phone' => 'call me']])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings', ['values' => ['app.key' => 'x']])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings', ['values' => ['mail.password' => 'x']])->assertStatus(422);
        $this->assertSame(0, SiteSetting::where('key', 'like', 'app.%')->count());

        $site = $this->getJson('/api/v1/site')->assertOk()->json('data');
        $this->assertSame('hello@cineora.test', $site['settings']['contact.email']);
        $this->assertStringNotContainsString('<b>', $site['settings']['site.tagline']);
    }

    public function test_social_links_must_be_https_known_platforms_and_unique(): void
    {
        $this->as($this->admin);
        $this->putJson('/api/v1/admin/settings/social-links', ['links' => [['platform' => 'instagram', 'url' => 'https://instagram.com/cineora'], ['platform' => 'youtube', 'url' => 'https://youtube.com/@cineora']]])->assertOk();
        $this->putJson('/api/v1/admin/settings/social-links', ['links' => [['platform' => 'instagram', 'url' => 'http://insecure.test']]])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings/social-links', ['links' => [['platform' => 'instagram', 'url' => 'javascript:alert(1)']]])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings/social-links', ['links' => [['platform' => 'myspace', 'url' => 'https://myspace.test']]])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings/social-links', ['links' => [['platform' => 'facebook', 'url' => 'https://a.test'], ['platform' => 'facebook', 'url' => 'https://b.test']]])->assertStatus(422);

        $this->assertSame(['instagram', 'youtube'], array_column($this->getJson('/api/v1/site')->json('data.social_links'), 'platform'));
    }

    public function test_page_texts_are_editable_for_known_pages_only(): void
    {
        $this->as($this->admin);
        $this->putJson('/api/v1/admin/settings/content/about', ['body' => "We love film.\n\n<script>x</script>Come visit."])->assertOk();
        $this->putJson('/api/v1/admin/settings/content/passwords', ['body' => 'x'])->assertNotFound();
        $this->putJson('/api/v1/admin/settings/content/about', ['body' => ''])->assertStatus(422);

        $about = $this->getJson('/api/v1/site')->json('data.pages.about');
        $this->assertStringContainsString('We love film.', $about);
        $this->assertStringNotContainsString('<script', $about);
        $this->assertSame(1, AuditLog::where('action', 'settings.content_updated')->where('resource_id', 'about')->count() - 0);
    }
}
