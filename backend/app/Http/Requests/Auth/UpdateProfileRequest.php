<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Email, roles and activation are intentionally not editable here. */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+\-\s()]{6,32}$/'],
            'locale' => ['sometimes', 'string', 'in:en,ko'],
            'marketing_opt_in' => ['sometimes', 'boolean'],
        ];
    }
}
