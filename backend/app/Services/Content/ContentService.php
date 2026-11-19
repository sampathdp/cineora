<?php

namespace App\Services\Content;

use App\Enums\ContentStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Article;
use App\Models\Event;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Media\SecureUploadService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Events and news articles: drafts, immediate or scheduled publishing, images and plain-text bodies.
 *
 * Bodies are stored as plain text (paragraphs separated by blank lines) with every tag removed on the way in, and are
 * escaped by the frontend on the way out, so editors can never inject markup or script.
 */
class ContentService
{
    public function __construct(private readonly AuditLogger $audit, private readonly SecureUploadService $uploads) {}

    public static function plain(?string $text, int $max = 20000): ?string
    {
        if ($text === null) {
            return null;
        }
        $clean = trim(preg_replace("/\r\n?/", "\n", strip_tags($text)));

        return mb_substr(preg_replace("/\n{3,}/", "\n\n", $clean), 0, $max);
    }

    /** @param  array<string, mixed>  $data  validated fields of the model */
    public function save(Model $model, array $data, User $actor): Model
    {
        $kind = $model instanceof Event ? 'event' : 'article';
        $creating = ! $model->exists;

        foreach (['title', 'excerpt', 'seo_title', 'seo_description'] as $f) {
            if (array_key_exists($f, $data)) {
                $data[$f] = self::plain($data[$f], 320);
            }
        }
        if (array_key_exists('body', $data)) {
            $data['body'] = self::plain($data['body']);
        }
        $model->fill($data);
        if ($creating) {
            $model->status = ContentStatus::Draft;
            $model->slug = $this->uniqueSlug($model::class, $data['slug'] ?? $data['title']);
            if ($model instanceof Article) {
                $model->author_id = $actor->id;
            }
        }
        $model->save();
        $this->audit->log("{$kind}.".($creating ? 'created' : 'updated'), $actor, $kind, $model->public_id, ['fields' => array_keys($data)]);

        return $model;
    }

    public function publish(Model $model, User $actor): Model
    {
        if (blank($model->title) || blank($model->body)) {
            throw ValidationException::withMessages(['body' => ['Add a title and some text before publishing.']]);
        }
        $model->status = ContentStatus::Published;
        $model->published_at ??= now();
        $model->scheduled_at = null;
        $model->save();
        $this->audit->log($this->kind($model).'.published', $actor, $this->kind($model), $model->public_id);

        return $model;
    }

    public function schedule(Model $model, Carbon $at, User $actor): Model
    {
        if ($at->lte(now())) {
            throw ValidationException::withMessages(['scheduled_at' => ['Choose a time in the future, or publish now.']]);
        }
        if (blank($model->title) || blank($model->body)) {
            throw ValidationException::withMessages(['body' => ['Add a title and some text before scheduling.']]);
        }
        $model->status = ContentStatus::Scheduled;
        $model->scheduled_at = $at->utc();
        $model->save();
        $this->audit->log($this->kind($model).'.scheduled', $actor, $this->kind($model), $model->public_id, ['at' => $at->utc()->toIso8601String()]);

        return $model;
    }

    public function unpublish(Model $model, User $actor): Model
    {
        $model->status = ContentStatus::Draft;
        $model->scheduled_at = null;
        $model->save();
        $this->audit->log($this->kind($model).'.unpublished', $actor, $this->kind($model), $model->public_id);

        return $model;
    }

    public function image(Model $model, UploadedFile $file, User $actor): Model
    {
        $dir = $model instanceof Event ? 'events' : 'articles';
        $new = $this->uploads->storeImage($file, $dir);
        $old = $model->image_path;
        $model->forceFill(['image_path' => $new])->save();
        $this->uploads->delete($old, ['events', 'articles']);
        $this->audit->log($this->kind($model).'.image_uploaded', $actor, $this->kind($model), $model->public_id);

        return $model;
    }

    public function delete(Model $model, User $actor): void
    {
        $this->uploads->delete($model->image_path, ['events', 'articles']);
        $model->delete();
        $this->audit->log($this->kind($model).'.deleted', $actor, $this->kind($model), $model->public_id);
    }

    /** Scheduler: publish everything whose time has come. Idempotent. */
    public function publishDue(): int
    {
        $n = 0;
        foreach ([Event::class, Article::class] as $class) {
            $n += $class::where('status', ContentStatus::Scheduled->value)->where('scheduled_at', '<=', now())
                ->update(['status' => ContentStatus::Published->value, 'published_at' => now(), 'scheduled_at' => null]);
        }

        return $n;
    }

    private function kind(Model $m): string
    {
        return $m instanceof Event ? 'event' : 'article';
    }

    private function uniqueSlug(string $class, string $source): string
    {
        $base = Str::slug($source) ?: 'item';
        $slug = $base;
        for ($i = 2; $class::where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }
        if (mb_strlen($slug) > 200) {
            throw new DomainConflictException('The title is too long to make a link.', 'slug_too_long');
        }

        return $slug;
    }
}
