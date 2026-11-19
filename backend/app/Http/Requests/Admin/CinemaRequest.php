<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CinemaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // authorised in the controller via CinemaPolicy
    }

    public function rules(): array
    {
        $req = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$req, 'string', 'max:160'],
            'slug' => ['sometimes', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'area' => ['sometimes', 'nullable', 'string', 'max:120'],
            'address' => [$req, 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+\-\s()]{6,32}$/'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'timezone' => ['sometimes', 'timezone:all'],
            'is_active' => ['sometimes', 'boolean'],
            'facilities' => ['sometimes', 'array', 'max:30'],
            'facilities.*' => ['string', 'max:96'],
            'art_theme' => ['sometimes', 'nullable', 'array'],
            'art_theme.from' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.to' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.accent' => ['required_with:art_theme', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'art_theme.motif' => ['required_with:art_theme', Rule::in(['moon', 'mountains', 'city', 'sun', 'stars', 'waves', 'forest', 'door', 'eye'])],
        ];
    }
}
