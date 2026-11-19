<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            // Uniqueness is deliberately NOT validated here (enumeration resistance); the controller handles duplicates silently.
            'email' => ['required', 'email:rfc', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+\-\s()]{6,32}$/'],
            'terms' => ['accepted'],
        ];
    }
}
