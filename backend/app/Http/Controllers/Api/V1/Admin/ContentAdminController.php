<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ContentStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Models\ContactMessage;
use App\Models\Event;
use App\Models\NewsletterSubscriber;
use App\Models\Testimonial;
use App\Services\Audit\AuditLogger;
use App\Services\Content\ContentService;
use App\Services\Media\SecureUploadService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/** Editorial content for staff with content.manage: events, news, categories, testimonials and the visitor inbox. */
class ContentAdminController extends Controller
{
    public function __construct(private readonly ContentService $content, private readonly SecureUploadService $uploads, private readonly AuditLogger $audit) {}

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission(Permission::ContentManage), 403);
    }

    // --- Events and articles (shared lifecycle) ---------------------------------------------

    public function events(Request $request): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success(Event::with('cinema')->latest('id')->limit(200)->get()->map(fn ($e) => $this->presentEvent($e))->values());
    }

    public function storeEvent(Request $request): JsonResponse
    {
        $this->guard($request);
        $e = $this->content->save(new Event, $this->eventFields($request, true), $request->user());

        return ApiResponse::success($this->presentEvent($e->load('cinema')), 'Event created as a draft.', status: 201);
    }

    public function updateEvent(Request $request, Event $event): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success($this->presentEvent($this->content->save($event, $this->eventFields($request, false), $request->user())->load('cinema')), 'Event updated.');
    }

    public function articles(Request $request): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success(Article::with('category')->latest('id')->limit(200)->get()->map(fn ($a) => $this->presentArticle($a))->values());
    }

    public function storeArticle(Request $request): JsonResponse
    {
        $this->guard($request);
        $a = $this->content->save(new Article, $this->articleFields($request, true), $request->user());

        return ApiResponse::success($this->presentArticle($a->load('category')), 'Article created as a draft.', status: 201);
    }

    public function updateArticle(Request $request, Article $article): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success($this->presentArticle($this->content->save($article, $this->articleFields($request, false), $request->user())->load('category')), 'Article updated.');
    }

    /** publish | unpublish | schedule for either kind */
    public function transition(Request $request, string $kind, string $id, string $action): JsonResponse
    {
        $this->guard($request);
        $model = $this->find($kind, $id);
        $model = match ($action) {
            'publish' => $this->content->publish($model, $request->user()),
            'unpublish' => $this->content->unpublish($model, $request->user()),
            'schedule' => $this->content->schedule($model, Carbon::parse($request->validate(['scheduled_at' => ['required', 'date']])['scheduled_at']), $request->user()),
            default => abort(404),
        };

        return ApiResponse::success($kind === 'events' ? $this->presentEvent($model->load('cinema')) : $this->presentArticle($model->load('category')), 'Updated.');
    }

    public function image(Request $request, string $kind, string $id): JsonResponse
    {
        $this->guard($request);
        $request->validate(['image' => ['required', 'file', 'max:'.config('uploads.image.max_kb')]]);
        $model = $this->content->image($this->find($kind, $id), $request->file('image'), $request->user());

        return ApiResponse::success($kind === 'events' ? $this->presentEvent($model->load('cinema')) : $this->presentArticle($model->load('category')), 'Image updated.');
    }

    public function destroy(Request $request, string $kind, string $id): JsonResponse
    {
        $this->guard($request);
        $this->content->delete($this->find($kind, $id), $request->user());

        return ApiResponse::success(null, 'Deleted.');
    }

    // --- Categories, testimonials ------------------------------------------------------------

    public function categories(Request $request): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success(ArticleCategory::orderBy('name')->get(['slug', 'name']));
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->guard($request);
        $v = $request->validate(['name' => ['required', 'string', 'min:2', 'max:60']]);
        $c = ArticleCategory::firstOrCreate(['slug' => \Illuminate\Support\Str::slug($v['name']) ?: 'category'], ['name' => ContentService::plain($v['name'], 60)]);
        $this->audit->log('article_category.created', $request->user(), 'article_category', $c->slug);

        return ApiResponse::success(['slug' => $c->slug, 'name' => $c->name], status: 201);
    }

    public function testimonials(Request $request): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success(Testimonial::orderBy('sort_order')->orderBy('id')->get()->map(fn ($t) => $this->presentTestimonial($t))->values());
    }

    public function storeTestimonial(Request $request): JsonResponse
    {
        $this->guard($request);
        $t = Testimonial::create($this->testimonialFields($request, true));
        $this->audit->log('testimonial.created', $request->user(), 'testimonial', $t->id);

        return ApiResponse::success($this->presentTestimonial($t), status: 201);
    }

    public function updateTestimonial(Request $request, Testimonial $testimonial): JsonResponse
    {
        $this->guard($request);
        $testimonial->update($this->testimonialFields($request, false));
        $this->audit->log('testimonial.updated', $request->user(), 'testimonial', $testimonial->id);

        return ApiResponse::success($this->presentTestimonial($testimonial));
    }

    public function destroyTestimonial(Request $request, Testimonial $testimonial): JsonResponse
    {
        $this->guard($request);
        $testimonial->delete();
        $this->audit->log('testimonial.deleted', $request->user(), 'testimonial', $testimonial->id);

        return ApiResponse::success(null, 'Deleted.');
    }

    // --- Visitor inbox --------------------------------------------------------------------------

    public function messages(Request $request): JsonResponse
    {
        $this->guard($request);
        $status = $request->validate(['status' => ['sometimes', 'in:new,handled']])['status'] ?? null;
        $page = ContactMessage::when($status, fn ($q, $s) => $q->where('status', $s))->latest('id')->paginate(25);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($m) => [
            'id' => $m->id, 'name' => $m->name, 'email' => $m->email, 'subject' => $m->subject, 'message' => $m->message, 'status' => $m->status, 'received_at' => $m->created_at?->copy()->utc()->toIso8601String(),
        ])->values()->all());
    }

    public function markMessageHandled(Request $request, ContactMessage $message): JsonResponse
    {
        $this->guard($request);
        $message->forceFill(['status' => 'handled'])->save();

        return ApiResponse::success(null, 'Marked as handled.');
    }

    public function subscribers(Request $request): JsonResponse
    {
        $this->guard($request);
        $page = NewsletterSubscriber::whereNull('unsubscribed_at')->latest('id')->paginate(50);

        return ApiResponse::paginated($page, $page->getCollection()->map(fn ($s) => ['email' => $s->email, 'subscribed_at' => $s->created_at?->copy()->utc()->toIso8601String()])->values()->all());
    }

    // --- internals --------------------------------------------------------------------------------

    private function find(string $kind, string $id)
    {
        return match ($kind) {
            'events' => Event::where('public_id', $id)->firstOrFail(),
            'articles' => Article::where('public_id', $id)->firstOrFail(),
            default => abort(404),
        };
    }

    private function eventFields(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';
        $v = $request->validate([
            'title' => [$req, 'string', 'min:2', 'max:200'], 'body' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'starts_at' => ['sometimes', 'nullable', 'date'], 'ends_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:starts_at'],
            'cinema' => ['sometimes', 'nullable', 'string', 'size:26', 'exists:cinemas,public_id'], 'is_featured' => ['sometimes', 'boolean'],
            'seo_title' => ['sometimes', 'nullable', 'string', 'max:255'], 'seo_description' => ['sometimes', 'nullable', 'string', 'max:320'],
        ]);
        if (array_key_exists('cinema', $v)) {
            $v['cinema_id'] = $v['cinema'] ? \App\Models\Cinema::where('public_id', $v['cinema'])->value('id') : null;
            unset($v['cinema']);
        }

        return $v;
    }

    private function articleFields(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';
        $v = $request->validate([
            'title' => [$req, 'string', 'min:2', 'max:200'], 'excerpt' => ['sometimes', 'nullable', 'string', 'max:500'], 'body' => ['sometimes', 'nullable', 'string', 'max:50000'],
            'category' => ['sometimes', 'nullable', 'string', 'exists:article_categories,slug'], 'is_featured' => ['sometimes', 'boolean'],
            'seo_title' => ['sometimes', 'nullable', 'string', 'max:255'], 'seo_description' => ['sometimes', 'nullable', 'string', 'max:320'],
        ]);
        if (array_key_exists('category', $v)) {
            $v['category_id'] = $v['category'] ? ArticleCategory::where('slug', $v['category'])->value('id') : null;
            unset($v['category']);
        }

        return $v;
    }

    private function testimonialFields(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';
        $v = $request->validate([
            'name' => [$req, 'string', 'min:2', 'max:100'], 'title' => ['sometimes', 'nullable', 'string', 'max:100'], 'quote' => [$req, 'string', 'min:10', 'max:600'],
            'rating' => ['sometimes', 'integer', 'between:1,5'], 'is_published' => ['sometimes', 'boolean'], 'sort_order' => ['sometimes', 'integer', 'between:0,1000'],
        ]);
        foreach (['name', 'title', 'quote'] as $f) {
            if (isset($v[$f])) {
                $v[$f] = ContentService::plain($v[$f], 600);
            }
        }

        return $v;
    }

    private function presentEvent(Event $e): array
    {
        return [
            'id' => $e->public_id, 'slug' => $e->slug, 'title' => $e->title, 'body' => $e->body, 'status' => $e->status->value, 'is_featured' => $e->is_featured,
            'image_url' => $this->uploads->url($e->image_path), 'starts_at' => $e->starts_at?->copy()->utc()->toIso8601String(), 'ends_at' => $e->ends_at?->copy()->utc()->toIso8601String(),
            'scheduled_at' => $e->scheduled_at?->copy()->utc()->toIso8601String(), 'published_at' => $e->published_at?->copy()->utc()->toIso8601String(),
            'cinema' => $e->cinema ? ['id' => $e->cinema->public_id, 'name' => $e->cinema->name] : null, 'seo_title' => $e->seo_title, 'seo_description' => $e->seo_description,
        ];
    }

    private function presentArticle(Article $a): array
    {
        return [
            'id' => $a->public_id, 'slug' => $a->slug, 'title' => $a->title, 'excerpt' => $a->excerpt, 'body' => $a->body, 'status' => $a->status->value, 'is_featured' => $a->is_featured,
            'image_url' => $this->uploads->url($a->image_path), 'category' => $a->category ? ['slug' => $a->category->slug, 'name' => $a->category->name] : null,
            'scheduled_at' => $a->scheduled_at?->copy()->utc()->toIso8601String(), 'published_at' => $a->published_at?->copy()->utc()->toIso8601String(), 'seo_title' => $a->seo_title, 'seo_description' => $a->seo_description,
        ];
    }

    private function presentTestimonial(Testimonial $t): array
    {
        return ['id' => $t->id, 'name' => $t->name, 'title' => $t->title, 'quote' => $t->quote, 'rating' => (int) $t->rating, 'is_published' => (bool) $t->is_published, 'sort_order' => (int) $t->sort_order];
    }
}
