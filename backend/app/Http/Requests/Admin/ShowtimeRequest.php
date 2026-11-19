<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ShowtimeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // authorised in the controller via ShowtimePolicy
    }

    public function rules(): array
    {
        $req = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'movie' => [$req, 'string', 'size:26', 'exists:movies,public_id'],
            'room' => [$req, 'string', 'size:26', 'exists:screening_rooms,public_id'],
            // ISO 8601 with an explicit offset (e.g. 2026-12-01T19:30:00+09:00): no ambiguous local times.
            'starts_at' => [$req, 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/'],
            'sales_cutoff_minutes' => ['sometimes', 'integer', 'between:0,240'],
            'prices' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'array', 'min:1', 'max:20'],
            'prices.*.category_key' => ['required', 'string', 'max:48'],
            'prices.*.price' => ['required', 'integer', 'between:0,'.config('cineora.showtime.max_price')],
        ];
    }
}
