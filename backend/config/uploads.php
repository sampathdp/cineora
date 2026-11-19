<?php

return [
    // Public, re-encoded catalogue images (posters, banners, cinema photos, article images).
    'image' => [
        'disk' => env('UPLOADS_IMAGE_DISK', 'public'),
        'max_kb' => (int) env('UPLOADS_IMAGE_MAX_KB', 5120),
        'max_dimension' => 5000,   // reject anything larger (decompression-bomb guard)
        'min_dimension' => 100,
        'output_max_side' => 2400, // downscale longer sides
        'mimes' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
    ],

    // Customer payment proofs: private disk, images are re-encoded, PDFs are screened for active content.
    'proof' => [
        'disk' => 'private',
        'max_kb' => 5120,
        'mimes' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'],
    ],
];
