<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Assigns a request correlation id (never trusting a malformed client value),
 * adds it to log context and returns it as X-Request-Id.
 */
class CorrelationId
{
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = (string) $request->headers->get('X-Request-Id', '');
        $id = preg_match('/^[A-Za-z0-9\-]{8,64}$/', $incoming) ? $incoming : (string) Str::uuid();

        $request->attributes->set('correlation_id', $id);
        Context::add('correlation_id', $id);
        Log::shareContext(['correlation_id' => $id]);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $id);

        return $response;
    }
}
