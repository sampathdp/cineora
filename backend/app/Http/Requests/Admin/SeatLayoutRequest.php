<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SeatLayoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // authorised in the controller via ScreeningRoomPolicy
    }

    public function rules(): array
    {
        return [
            'seats' => ['required', 'array', 'min:1', 'max:600'],
            'seats.*.row_label' => ['required', 'string', 'regex:/^[A-Za-z]{1,2}$/'],
            'seats.*.number' => ['required', 'integer', 'between:1,99'],
            'seats.*.category_key' => ['required', 'string', 'max:48'],
            'seats.*.x' => ['nullable', 'integer', 'between:-1000,1000'],
            'seats.*.y' => ['nullable', 'integer', 'between:-1000,1000'],
        ];
    }
}
