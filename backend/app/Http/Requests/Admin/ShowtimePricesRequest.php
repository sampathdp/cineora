<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ShowtimePricesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prices' => ['required', 'array', 'min:1', 'max:20'],
            'prices.*.category_key' => ['required', 'string', 'max:48'],
            'prices.*.price' => ['required', 'integer', 'between:0,'.config('cineora.showtime.max_price')],
        ];
    }
}
