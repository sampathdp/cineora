<?php

namespace App\Services\Media;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Stores user-supplied files safely:
 *  - the real content type is sniffed (client MIME type and file extension are ignored),
 *  - images are fully decoded and re-encoded with GD, which strips metadata and any appended payload,
 *  - PDFs (payment proofs only) must look like a PDF and must not contain active content markers,
 *  - the stored name is server generated; the client file name is never used,
 *  - dimensions and size are capped.
 */
class SecureUploadService
{
    /** Active-content markers: a payment proof has no legitimate use for any of these. */
    private const PDF_FORBIDDEN = ['/JavaScript', '/JS', '/Launch', '/OpenAction', '/AA', '/EmbeddedFile', '/RichMedia', '/XFA', '/SubmitForm', '/ImportData'];

    /** @return string storage path relative to the disk root */
    public function storeImage(UploadedFile $file, string $directory, string $field = 'image'): string
    {
        $cfg = config('uploads.image');
        $this->assertUsable($file, $cfg['max_kb'], $field);
        [$bytes, $ext] = $this->reencodeImage($file, $field, $cfg['mimes']);

        $name = trim($directory, '/').'/'.Str::lower((string) Str::ulid()).'.'.$ext;
        Storage::disk($cfg['disk'])->put($name, $bytes);

        return $name;
    }

    /**
     * Stores a payment proof (JPEG, PNG, WebP or PDF) on the private disk.
     *
     * @return array{disk: string, path: string, mime: string, size: int, sha256: string}
     */
    public function storeProof(UploadedFile $file, string $directory, string $field = 'proof'): array
    {
        $cfg = config('uploads.proof');
        $this->assertUsable($file, $cfg['max_kb'], $field);

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()) ?: '';
        if (! isset($cfg['mimes'][$mime])) {
            $this->fail($field, 'Upload a JPEG, PNG, WebP or PDF file.');
        }

        if ($mime === 'application/pdf') {
            $bytes = (string) file_get_contents($file->getRealPath());
            if (! str_starts_with($bytes, '%PDF-')) {
                $this->fail($field, 'The file is not a valid PDF.');
            }
            foreach (self::PDF_FORBIDDEN as $marker) {
                if (str_contains($bytes, $marker)) {
                    $this->fail($field, 'This PDF contains interactive content and cannot be accepted. Upload a screenshot or a plain PDF.');
                }
            }
            $ext = 'pdf';
        } else {
            [$bytes, $ext] = $this->reencodeImage($file, $field, array_diff_key($cfg['mimes'], ['application/pdf' => 1]));
            $mime = array_search($ext, $cfg['mimes'], true);
        }

        $path = trim($directory, '/').'/'.Str::lower((string) Str::ulid()).'.'.$ext;
        Storage::disk($cfg['disk'])->put($path, $bytes);

        return ['disk' => $cfg['disk'], 'path' => $path, 'mime' => $mime, 'size' => strlen($bytes), 'sha256' => hash('sha256', $bytes)];
    }

    /** Deletes a previously stored file. Paths outside the caller-supplied directories are refused. */
    public function delete(?string $path, array $allowedDirectories, ?string $disk = null): void
    {
        if (! $path || str_contains($path, '..')) {
            return;
        }
        foreach ($allowedDirectories as $dir) {
            if (str_starts_with($path, trim($dir, '/').'/')) {
                Storage::disk($disk ?? config('uploads.image.disk'))->delete($path);

                return;
            }
        }
    }

    public function url(?string $path): ?string
    {
        return $path ? Storage::disk(config('uploads.image.disk'))->url($path) : null;
    }

    private function assertUsable(UploadedFile $file, int $maxKb, string $field): void
    {
        if (! $file->isValid()) {
            $this->fail($field, 'The upload failed. Please try again.');
        }
        if ($file->getSize() === false || $file->getSize() === 0 || $file->getSize() > $maxKb * 1024) {
            $this->fail($field, 'The file must be between 1 byte and '.round($maxKb / 1024, 1).' MB.');
        }
    }

    /**
     * Decodes and re-encodes an image.
     *
     * @param  array<string, string>  $allowed  mime => extension
     * @return array{0: string, 1: string} bytes and extension
     */
    private function reencodeImage(UploadedFile $file, string $field, array $allowed): array
    {
        $cfg = config('uploads.image');
        $path = $file->getRealPath();

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path) ?: '';
        if (! isset($allowed[$mime])) {
            $this->fail($field, 'Only JPEG, PNG or WebP images are allowed.');
        }

        $info = @getimagesize($path);
        if ($info === false || ($info['mime'] ?? null) !== $mime) {
            $this->fail($field, 'The file is not a valid image.');
        }
        [$w, $h] = $info;
        if ($w > $cfg['max_dimension'] || $h > $cfg['max_dimension']) {
            $this->fail($field, "The image is too large (maximum {$cfg['max_dimension']}px per side).");
        }
        if ($w < $cfg['min_dimension'] || $h < $cfg['min_dimension']) {
            $this->fail($field, "The image is too small (minimum {$cfg['min_dimension']}px per side).");
        }

        $image = @imagecreatefromstring((string) file_get_contents($path));
        if ($image === false) {
            $this->fail($field, 'The file is not a valid image.');
        }

        $longest = max($w, $h);
        if ($longest > $cfg['output_max_side']) {
            $scaled = imagescale($image, (int) round($w * $cfg['output_max_side'] / $longest), -1);
            if ($scaled !== false) {
                $image = $scaled;
            }
        }

        // Every accepted image is stored as WebP (smaller, keeps PNG transparency). Falls back to the
        // source format only if this PHP build's GD has no WebP encoder.
        $ext = function_exists('imagewebp') ? 'webp' : $allowed[$mime];
        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }
        imagealphablending($image, false);
        imagesavealpha($image, true);
        ob_start();
        match ($ext) {
            'webp' => imagewebp($image, null, (int) $cfg['webp_quality']),
            'png' => imagepng($image, null, 6),
            default => imagejpeg($image, null, 88),
        };
        $bytes = (string) ob_get_clean();

        if ($bytes === '') {
            $this->fail($field, 'The image could not be processed.');
        }

        return [$bytes, $ext];
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
