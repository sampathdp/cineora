<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\ContentStatus;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Models\ContactMessage;
use App\Models\Event;
use App\Models\NewsletterSubscriber;
use App\Models\SiteContent;
use App\Models\SiteSetting;
use App\Models\SocialLink;
use App\Models\Testimonial;
use App\Services\Content\ContentService;
use App\Services\Media\SecureUploadService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Public website content. Only published items are visible; bodies are plain text split into paragraphs. */
class ContentController extends Controller
{
    public function __construct(private readonly SecureUploadService $uploads) {}

    public function site(): JsonResponse
    {
        return ApiResponse::success([
            'settings' => SiteSetting::where('is_public', true)->pluck('value', 'key'),
            'social_links' => SocialLink::orderBy('sort_order')->get(['platform', 'url']),
            'pages' => SiteContent::where('locale', 'en')->pluck('body', 'key'),
        ]);
    }

    public function events(): JsonResponse
    {
        $list = Event::with('cinema')->where('status', ContentStatus::Published->value)->orderByDesc('starts_at')->orderByDesc('id')->limit(100)->get();

        return ApiResponse::success($list->map(fn ($e) => $this->presentEvent($e, false))->values());
    }

    public function event(string $slug): JsonResponse
    {
        $e = Event::with('cinema')->where('status', ContentStatus::Published->value)->where('slug', $slug)->firstOrFail();

        return ApiResponse::success($this->presentEvent($e, true));
    }

    public function articles(Request $request): JsonResponse
    {
        $v = $request->validate(['category' => ['sometimes', 'string', 'max:100'], 'per_page' => ['sometimes', 'integer', 'between:1,50']]);
        $page = Article::with('category')->where('status', ContentStatus::Published->value)
            ->when($v['category'] ?? null, fn ($q, $c) => $q->whereHas('category', fn ($cat) => $cat->where('slug', $c)))
            ->orderByDesc('published_at')->orderByDesc('id')->paginate($v['per_page'] ?? 12);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($a) => $this->presentArticle($a, false))->values()->all());
    }

    public function article(string $slug): JsonResponse
    {
        $a = Article::with('category')->where('status', ContentStatus::Published->value)->where('slug', $slug)->firstOrFail();

        return ApiResponse::success($this->presentArticle($a, true));
    }

    public function categories(): JsonResponse
    {
        return ApiResponse::success(ArticleCategory::whereHas('articles', fn ($q) => $q->where('status', ContentStatus::Published->value))->orderBy('name')->get(['slug', 'name']));
    }

    public function testimonials(): JsonResponse
    {
        return ApiResponse::success(Testimonial::where('is_published', true)->orderBy('sort_order')->orderBy('id')->limit(30)->get(['name', 'title', 'quote', 'rating']));
    }

    /** Honeypot field `website` must stay empty; bots that fill it get a normal-looking answer and nothing is stored. */
    public function contact(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'], 'email' => ['required', 'email:rfc', 'max:255'],
            'subject' => ['required', 'string', 'min:3', 'max:150'], 'message' => ['required', 'string', 'min:10', 'max:3000'], 'website' => ['sometimes', 'nullable', 'string', 'max:200'],
        ]);
        if (blank($v['website'] ?? null)) {
            ContactMessage::create([
                'name' => ContentService::plain($v['name'], 100), 'email' => $v['email'], 'subject' => ContentService::plain($v['subject'], 150),
                'message' => ContentService::plain($v['message'], 3000), 'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
            ]);
        }

        return ApiResponse::success(null, 'Thank you. We have received your message and will reply by email.', status: 201);
    }

    /** Same answer whether or not the address is already subscribed (no enumeration). */
    public function newsletter(Request $request): JsonResponse
    {
        $v = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = mb_strtolower(trim($v['email']));
        NewsletterSubscriber::firstOrCreate(['email' => $email], ['token_hash' => hash('sha256', Str::random(40)), 'confirmed_at' => now()]);

        return ApiResponse::success(null, 'You are subscribed. Thank you!', status: 201);
    }

    private function presentEvent(Event $e, bool $full): array
    {
        return [
            'slug' => $e->slug, 'title' => $e->title, 'image_url' => $this->uploads->url($e->image_path), 'is_featured' => $e->is_featured,
            'starts_at' => $e->starts_at?->copy()->utc()->toIso8601String(), 'ends_at' => $e->ends_at?->copy()->utc()->toIso8601String(),
            'cinema' => $e->cinema ? ['slug' => $e->cinema->slug, 'name' => $e->cinema->name, 'timezone' => $e->cinema->timezone] : null,
            'summary' => Str::limit((string) $e->body, 180),
            ...($full ? ['paragraphs' => $this->paragraphs($e->body), 'seo_title' => $e->seo_title, 'seo_description' => $e->seo_description] : []),
        ];
    }

    private function presentArticle(Article $a, bool $full): array
    {
        return [
            'slug' => $a->slug, 'title' => $a->title, 'excerpt' => $a->excerpt ?: Str::limit((string) $a->body, 180), 'image_url' => $this->uploads->url($a->image_path),
            'category' => $a->category ? ['slug' => $a->category->slug, 'name' => $a->category->name] : null, 'published_at' => $a->published_at?->copy()->utc()->toIso8601String(),
            ...($full ? ['paragraphs' => $this->paragraphs($a->body), 'seo_title' => $a->seo_title, 'seo_description' => $a->seo_description] : []),
        ];
    }

    /** @return list<string> */
    private function paragraphs(?string $body): array
    {
        return array_values(array_filter(array_map('trim', preg_split("/\n{2,}/", (string) $body))));
    }
}
