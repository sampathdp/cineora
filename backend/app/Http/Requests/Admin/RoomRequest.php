<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // authorised in the controller via ScreeningRoomPolicy
    }

    public function rules(): array
    {
        $req = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$req, 'string', 'max:96'],
            'screen_type' => ['sometimes', 'string', 'max:64'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
