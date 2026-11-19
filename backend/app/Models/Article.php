<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Article extends Model
{
    use HasPublicId;

    protected $fillable = ['slug', 'category_id', 'title', 'excerpt', 'body', 'author_id', 'image_path', 'scheduled_at', 'is_featured', 'seo_title', 'seo_description'];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'published_at' => 'datetime',
            'is_featured' => 'boolean',
            'status' => \App\Enums\ContentStatus::class,
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ArticleCategory::class, 'category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
