<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Deliberately has no price, total, status, user or cinema fields: the server derives all of those.
 * Unknown keys are ignored (not copied anywhere) because the service only reads the whitelisted ones below.
 */
class CreateBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => ['required', 'string', 'regex:/^[A-Za-z0-9_\-]{8,80}$/'],
            'showtime' => ['required', 'string', 'size:26'],
            'seats' => ['required', 'array', 'min:1', 'max:'.config('cineora.booking.max_seats_per_booking')],
            'seats.*' => ['required', 'string', 'regex:/^[A-Za-z]{1,2}\d{1,2}$/'],
            'promo_code' => ['sometimes', 'nullable', 'string', 'max:48'],
        ];
    }

    public function messages(): array
    {
        return ['idempotency_key.required' => 'An Idempotency-Key header is required.', 'idempotency_key.regex' => 'The Idempotency-Key header must be 8-80 letters, digits, dashes or underscores.'];
    }
}
