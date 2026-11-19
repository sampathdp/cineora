<?php

namespace App\Models;

use App\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Event extends Model
{
    use HasPublicId;

    protected $fillable = ['slug', 'title', 'body', 'image_path', 'cinema_id', 'starts_at', 'ends_at', 'scheduled_at', 'is_featured', 'seo_title', 'seo_description'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'published_at' => 'datetime',
            'is_featured' => 'boolean',
            'status' => \App\Enums\ContentStatus::class,
        ];
    }

    public function cinema(): BelongsTo
    {
        return $this->belongsTo(Cinema::class);
    }
}
