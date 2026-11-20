<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Many draft showtimes of one movie in one room, sharing prices and cut-off (the admin "schedule a range" form). */
class ShowtimeBulkRequest extends FormRequest
{
    public const MAX_SLOTS = 100;

    public function authorize(): bool
    {
        return true; // authorised in the controller via ShowtimePolicy
    }

    public function rules(): array
    {
        return [
            'movie' => ['required', 'string', 'size:26', 'exists:movies,public_id'],
            'room' => ['required', 'string', 'size:26', 'exists:screening_rooms,public_id'],
            'starts_at' => ['required', 'array', 'min:1', 'max:'.self::MAX_SLOTS],
            // ISO 8601 with an explicit offset, as for a single showtime.
            'starts_at.*' => ['required', 'string', 'distinct', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/'],
            'sales_cutoff_minutes' => ['sometimes', 'integer', 'between:0,240'],
            'prices' => ['required', 'array', 'min:1', 'max:20'],
            'prices.*.category_key' => ['required', 'string', 'max:48'],
            'prices.*.price' => ['required', 'integer', 'between:0,'.config('cineora.showtime.max_price')],
        ];
    }
}
