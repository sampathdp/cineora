<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and update. Note: `status`, `published_at` and `poster_path`/`banner_path` are not accepted here. */
class MovieRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // authorised in the controller via MoviePolicy
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $req = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$req, 'string', 'min:1', 'max:200'],
            'slug' => ['sometimes', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'tagline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'duration_min' => [$req, 'integer', 'between:1,600'],
            'release_date' => ['sometimes', 'nullable', 'date'],
            'age_rating' => ['sometimes', 'nullable', 'string', 'max:16'],
            'original_language' => ['sometimes', 'nullable', 'string', 'max:8'],
            'rating' => ['sometimes', 'nullable', 'numeric', 'between:0,10'],
            'screening_status' => ['sometimes', Rule::in(['now_playing', 'coming_soon'])],
            'is_featured' => ['sometimes', 'boolean'],
            'trailer_url' => ['sometimes', 'nullable', 'url:https', 'max:512', 'regex:~^https://(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)/~i'],
            'seo_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'seo_description' => ['sometimes', 'nullable', 'string', 'max:320'],
            'art_theme' => ['sometimes', 'nullable', 'array'],
            'art_theme.from' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.to' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.accent' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.motif' => ['required_with:art_theme', Rule::in(['moon', 'mountains', 'city', 'sun', 'stars', 'waves', 'forest', 'door', 'eye'])],
            'genres' => ['sometimes', 'array', 'max:6'],
            'genres.*' => ['string', 'exists:genres,slug'],
            'cast' => ['sometimes', 'array', 'max:40'],
            'cast.*.name' => ['required', 'string', 'max:120'],
            'cast.*.role' => ['nullable', 'string', 'max:120'],
            'crew' => ['sometimes', 'array', 'max:40'],
            'crew.*.name' => ['required', 'string', 'max:120'],
            'crew.*.job' => ['required', 'string', 'max:64'],
            'languages' => ['sometimes', 'array', 'max:20'],
            'languages.*.code' => ['required', 'string', 'max:8'],
            'languages.*.kind' => ['required', Rule::in(['audio', 'subtitle'])],
        ];
    }
}
