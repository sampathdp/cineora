<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Models\Event;
use App\Models\SiteSetting;
use App\Models\SocialLink;
use App\Models\Testimonial;
use Illuminate\Database\Seeder;

/** Local-development sample website content. Refuses to run outside local/testing. Idempotent. */
class DemoContentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        foreach ([
            'site.name' => 'CINEORA', 'site.tagline' => 'Cinema, booked beautifully.',
            'site.description' => 'Book cinema tickets online: pick your film, choose your seats and pay by bank transfer.',
            'contact.email' => 'hello@cineora.test', 'contact.phone' => '+82 2 000 0000', 'contact.address' => '100 Sample-ro, Seoul', 'contact.hours' => 'Daily 10:00 to 23:00',
        ] as $key => $value) {
            SiteSetting::firstOrCreate(['key' => $key], ['value' => $value, 'is_public' => true]);
        }
        if (SocialLink::count() === 0) {
            SocialLink::create(['platform' => 'instagram', 'url' => 'https://www.instagram.com/', 'sort_order' => 0]);
        }

        if (Testimonial::count() === 0) {
            foreach ([
                ['Sample Customer A', 'Regular guest', 'Choosing seats felt effortless and the whole flow was clear from start to finish.', 5],
                ['Sample Customer B', 'Weekend visitor', 'The seat map is easy to read even on a phone.', 5],
                ['Sample Customer C', 'Film club member', 'Showtimes and seat selection in one place, which is just what a good cinema site should do.', 4],
            ] as $i => [$name, $title, $quote, $rating]) {
                Testimonial::create(['name' => $name, 'title' => $title, 'quote' => $quote, 'rating' => $rating, 'is_published' => true, 'sort_order' => $i]);
            }
        }

        $category = ArticleCategory::firstOrCreate(['slug' => 'announcements'], ['name' => 'Announcements']);
        if (Article::count() === 0) {
            $article = new Article(['title' => 'Welcome to the new Cineora website', 'excerpt' => 'Book seats online and pay by bank transfer.', 'body' => "You can now pick your seats and book online.\n\nAfter you reserve, transfer the amount to our bank account and upload your receipt. Once our team verifies it, your QR tickets appear in your account.", 'category_id' => $category->id]);
            $article->slug = 'welcome-to-the-new-cineora-website';
            $article->status = ContentStatus::Published;
            $article->published_at = now();
            $article->save();
        }
        if (Event::count() === 0) {
            $event = new Event(['title' => 'Midnight Movie Marathon', 'body' => "Three films, one night.\n\nDoors open at 22:00. Snacks included.", 'starts_at' => now()->addDays(10)->setTime(22, 0), 'ends_at' => now()->addDays(11)->setTime(4, 0)]);
            $event->slug = 'midnight-movie-marathon';
            $event->status = ContentStatus::Published;
            $event->published_at = now();
            $event->save();
        }
    }
}
