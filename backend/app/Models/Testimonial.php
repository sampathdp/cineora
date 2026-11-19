<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Testimonial extends Model
{
    protected $fillable = ['name', 'title', 'quote', 'rating', 'is_published', 'sort_order'];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
        ];
    }
}
