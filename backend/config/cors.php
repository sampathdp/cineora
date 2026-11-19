<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_filter([env('FRONTEND_URL', 'http://localhost:3000')]),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Accept', 'X-XSRF-TOKEN', 'X-Requested-With', 'Idempotency-Key', 'X-Request-Id'],

    'exposed_headers' => ['X-Request-Id'],

    'max_age' => 0,

    'supports_credentials' => true,

];
