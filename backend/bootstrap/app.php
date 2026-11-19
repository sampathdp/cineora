<?php

use App\Http\Middleware\CorrelationId;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias([
            'staff' => \App\Http\Middleware\EnsureStaff::class,
            'mfa' => \App\Http\Middleware\EnsureMfa::class,
        ]);
        $middleware->prepend(CorrelationId::class);
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $wantsJson = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen($wantsJson);

        $exceptions->render(function (ValidationException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error('The submitted information is invalid.', 422, 'validation_failed', $e->errors());
            }
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error('Authentication required.', 401, 'unauthenticated');
            }
        });
        $exceptions->render(function (AuthorizationException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error('You are not allowed to perform this action.', 403, 'forbidden');
            }
        });
        $exceptions->render(function (TokenMismatchException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error('Session expired or CSRF token invalid.', 419, 'csrf_mismatch');
            }
        });
        $exceptions->render(function (\App\Exceptions\DomainConflictException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error($e->getMessage(), 409, $e->errorCode, $e instanceof \App\Services\Booking\SeatsUnavailableException ? ['seats' => $e->seats] : []);
            }
        });
        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                return ApiResponse::error('Resource not found.', 404, 'not_found');
            }
        });
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request)) {
                $status = $e->getStatusCode();
                $message = $status >= 500 ? 'An unexpected error occurred.' : ($e->getMessage() ?: 'Request could not be completed.');

                return ApiResponse::error($message, $status, 'http_'.$status)->withHeaders($e->getHeaders());
            }
        });
        // Anything else on the API: generic 500 (details stay in logs only).
        $exceptions->render(function (Throwable $e, Request $request) use ($wantsJson) {
            if ($wantsJson($request) && ! config('app.debug')) {
                return ApiResponse::error('An unexpected error occurred.', 500, 'server_error');
            }
        });
    })->create();
