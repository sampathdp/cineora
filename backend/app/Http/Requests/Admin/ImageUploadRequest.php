<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Only checks that a file was sent and is small; the real content validation (sniffed MIME, decode,
 * dimensions) is in SecureUploadService, which does not trust the client's type or extension.
 */
class ImageUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'max:'.config('uploads.image.max_kb')],
            'alt' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
