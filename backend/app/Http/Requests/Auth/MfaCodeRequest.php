<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class MfaCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'digits:6'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:32'],
        ];
    }
}
