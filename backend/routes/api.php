<?php

use App\Http\Controllers\Api\V1\Account\AccountController;
use App\Http\Controllers\Api\V1\Admin\CinemaAdminController;
use App\Http\Controllers\Api\V1\Admin\MovieAdminController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Customer\BookingController;
use App\Http\Controllers\Api\V1\Customer\PaymentController;
use App\Http\Controllers\Api\V1\Customer\TicketController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\MfaController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\RegistrationController;
use App\Http\Controllers\Api\V1\Admin\BankAccountAdminController;
use App\Http\Controllers\Api\V1\Admin\PaymentAdminController;
use App\Http\Controllers\Api\V1\Admin\RefundAdminController;
use App\Http\Controllers\Api\V1\Admin\ShowtimeAdminController;
use App\Http\Controllers\Api\V1\Admin\TicketAdminController;
use App\Http\Controllers\Api\V1\Admin\ScannerPairController;
use App\Http\Controllers\Api\V1\Admin\AuditLogController;
use App\Http\Controllers\Api\V1\Admin\BookingAdminController;
use App\Http\Controllers\Api\V1\Admin\ContentAdminController;
use App\Http\Controllers\Api\V1\Admin\CustomerAdminController;
use App\Http\Controllers\Api\V1\Admin\PromotionAdminController;
use App\Http\Controllers\Api\V1\Admin\ReportingController;
use App\Http\Controllers\Api\V1\Admin\SettingsAdminController;
use App\Http\Controllers\Api\V1\Admin\StaffAdminController;
use App\Http\Controllers\Api\V1\Public\CatalogController;
use App\Http\Controllers\Api\V1\Public\ContentController;
use App\Http\Controllers\Api\V1\Public\ShowtimeController;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Liveness/readiness. Exposes no internal detail.
    Route::get('/health', function () {
        try {
            DB::select('select 1');
        } catch (Throwable $e) {
            Log::error('Health check: database unreachable', ['exception' => $e::class]);

            return ApiResponse::error('Service unavailable.', 503, 'unhealthy');
        }

        return ApiResponse::success(['status' => 'ok'], 'Healthy');
    })->middleware('throttle:60,1');

    Route::prefix('auth')->group(function () {
        Route::post('/register', [RegistrationController::class, 'store'])->middleware('throttle:register');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('/staff/login', [AuthController::class, 'staffLogin'])->middleware('throttle:login');
        Route::post('/forgot-password', [PasswordController::class, 'forgot'])->middleware('throttle:password-reset');
        Route::post('/reset-password', [PasswordController::class, 'reset'])->middleware('throttle:password-reset');

        // Opened from the email client; protected by the URL signature, not a session.
        Route::get('/email/verify/{user:public_id}/{hash}', [EmailVerificationController::class, 'verify'])
            ->middleware(['signed', 'throttle:verification'])->name('auth.verify');

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/email/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:verification');
            Route::post('/password/change', [PasswordController::class, 'change'])->middleware('throttle:account');

            Route::prefix('mfa')->middleware('throttle:mfa')->group(function () {
                Route::post('/setup', [MfaController::class, 'setup'])->middleware('staff');
                Route::post('/confirm', [MfaController::class, 'confirm'])->middleware('staff');
                Route::post('/challenge', [MfaController::class, 'challenge'])->middleware('staff');
                Route::delete('/', [MfaController::class, 'disable'])->middleware('staff');
            });
        });
    });

    Route::prefix('account')->middleware(['auth:sanctum', 'throttle:account'])->group(function () {
        Route::get('/profile', [AccountController::class, 'profile']);
        Route::patch('/profile', [AccountController::class, 'updateProfile']);
        Route::get('/sessions', [AccountController::class, 'sessions']);
        Route::delete('/sessions/{handle}', [AccountController::class, 'revokeSession']);
    });

    // --- Customer bookings (session auth; every query is scoped to the signed-in user) ---
    Route::middleware(['auth:sanctum', 'throttle:account'])->group(function () {
        Route::get('/bookings', [BookingController::class, 'index']);
        Route::get('/bookings/{booking}', [BookingController::class, 'show']);
        Route::post('/bookings', [BookingController::class, 'store'])->middleware('throttle:booking');
        Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])->middleware('throttle:booking');

        Route::get('/bookings/{booking}/payment', [PaymentController::class, 'show']);
        Route::post('/bookings/{booking}/payment/proof', [PaymentController::class, 'submit'])->middleware('throttle:proof');
        Route::get('/bookings/{booking}/payment/proofs/{proof}', [PaymentController::class, 'proof'])->whereNumber('proof');
        Route::get('/bookings/{booking}/tickets', [TicketController::class, 'forBooking']);
        Route::get('/tickets', [TicketController::class, 'index']);
    });

    // --- Public catalogue (read-only, published/active records only) ---
    Route::middleware('throttle:public')->group(function () {
        Route::get('/movies', [CatalogController::class, 'movies']);
        Route::get('/movies/{movie:slug}', [CatalogController::class, 'movie']);
        Route::get('/genres', [CatalogController::class, 'genres']);
        Route::get('/cinemas', [CatalogController::class, 'cinemas']);
        Route::get('/cinemas/{cinema:slug}', [CatalogController::class, 'cinema']);
        Route::get('/site', [ContentController::class, 'site']);
        Route::get('/events', [ContentController::class, 'events']);
        Route::get('/events/{slug}', [ContentController::class, 'event']);
        Route::get('/articles', [ContentController::class, 'articles']);
        Route::get('/articles/{slug}', [ContentController::class, 'article']);
        Route::get('/article-categories', [ContentController::class, 'categories']);
        Route::get('/testimonials', [ContentController::class, 'testimonials']);
        Route::post('/contact', [ContentController::class, 'contact'])->middleware('throttle:contact');
        Route::post('/newsletter', [ContentController::class, 'newsletter'])->middleware('throttle:contact');
        Route::get('/showtimes', [ShowtimeController::class, 'index']);
        Route::get('/showtimes/{showtime}', [ShowtimeController::class, 'show']);
        Route::get('/showtimes/{showtime}/seats', [ShowtimeController::class, 'seats']);
    });

    // --- Paired phone camera for the door scanner: authorised by the pairing token, not a session ---
    Route::prefix('scanner/remote/{token}')->middleware('throttle:scanner')->group(function () {
        Route::get('/', [ScannerPairController::class, 'ping']);
        Route::post('/scan', [ScannerPairController::class, 'scan']);
    });

    // --- Admin: staff + MFA gate, then per-resource policies in the controllers ---
    Route::prefix('admin')->middleware(['auth:sanctum', 'staff', 'mfa', 'throttle:admin'])->group(function () {
        Route::get('/movies', [MovieAdminController::class, 'index']);
        Route::post('/movies', [MovieAdminController::class, 'store']);
        Route::get('/movies/{movie}', [MovieAdminController::class, 'show']);
        Route::patch('/movies/{movie}', [MovieAdminController::class, 'update']);
        Route::delete('/movies/{movie}', [MovieAdminController::class, 'destroy']);
        Route::post('/movies/{movie}/publish', [MovieAdminController::class, 'publish']);
        Route::post('/movies/{movie}/unpublish', [MovieAdminController::class, 'unpublish']);
        Route::post('/movies/{movie}/archive', [MovieAdminController::class, 'archive']);
        Route::post('/movies/{movie}/images/{kind}', [MovieAdminController::class, 'image']);

        Route::get('/seat-categories', [CinemaAdminController::class, 'seatCategories']);
        Route::get('/cinemas', [CinemaAdminController::class, 'index']);
        Route::post('/cinemas', [CinemaAdminController::class, 'store']);
        Route::get('/cinemas/{cinema}', [CinemaAdminController::class, 'show']);
        Route::patch('/cinemas/{cinema}', [CinemaAdminController::class, 'update']);
        Route::post('/cinemas/{cinema}/images', [CinemaAdminController::class, 'addImage']);
        Route::delete('/cinemas/{cinema}/images/{image}', [CinemaAdminController::class, 'removeImage']);
        Route::get('/cinemas/{cinema}/rooms', [CinemaAdminController::class, 'rooms']);
        Route::post('/cinemas/{cinema}/rooms', [CinemaAdminController::class, 'storeRoom']);
        Route::patch('/rooms/{room}', [CinemaAdminController::class, 'updateRoom']);
        Route::delete('/rooms/{room}', [CinemaAdminController::class, 'destroyRoom']);
        Route::get('/rooms/{room}/seats', [CinemaAdminController::class, 'seats']);
        Route::put('/rooms/{room}/seats', [CinemaAdminController::class, 'replaceSeats']);

        Route::get('/dashboard', [ReportingController::class, 'dashboard']);
        Route::get('/reports', [ReportingController::class, 'types']);
        Route::get('/reports/{type}', [ReportingController::class, 'show']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        Route::get('/bookings', [BookingAdminController::class, 'index']);
        Route::get('/bookings/{booking}', [BookingAdminController::class, 'show']);
        Route::post('/bookings/{booking}/cancel', [BookingAdminController::class, 'cancel']);
        Route::post('/bookings/{booking}/refund-request', [BookingAdminController::class, 'requestRefund']);
        Route::post('/bookings/{booking}/extend-payment', [BookingAdminController::class, 'extendPaymentTime']);
        Route::get('/customers', [CustomerAdminController::class, 'index']);
        Route::get('/customers/{user}', [CustomerAdminController::class, 'show']);

        Route::get('/staff', [StaffAdminController::class, 'index']);
        Route::post('/staff', [StaffAdminController::class, 'store']);
        Route::patch('/staff/{user}', [StaffAdminController::class, 'update']);
        Route::post('/staff/{user}/reset-mfa', [StaffAdminController::class, 'resetMfa']);
        Route::put('/staff/{user}/password', [StaffAdminController::class, 'password']);
        Route::get('/roles', [StaffAdminController::class, 'roles']);
        Route::get('/permissions', [StaffAdminController::class, 'permissions']);
        Route::post('/roles', [StaffAdminController::class, 'storeRole']);
        Route::patch('/roles/{role:key}', [StaffAdminController::class, 'updateRole']);
        Route::delete('/roles/{role:key}', [StaffAdminController::class, 'destroyRole']);

        Route::get('/promotions', [PromotionAdminController::class, 'index']);
        Route::post('/promotions', [PromotionAdminController::class, 'store']);
        Route::patch('/promotions/{promo}', [PromotionAdminController::class, 'update']);
        Route::delete('/promotions/{promo}', [PromotionAdminController::class, 'destroy']);

        Route::get('/events', [ContentAdminController::class, 'events']);
        Route::post('/events', [ContentAdminController::class, 'storeEvent']);
        Route::patch('/events/{event}', [ContentAdminController::class, 'updateEvent']);
        Route::get('/articles', [ContentAdminController::class, 'articles']);
        Route::post('/articles', [ContentAdminController::class, 'storeArticle']);
        Route::patch('/articles/{article}', [ContentAdminController::class, 'updateArticle']);
        Route::post('/content/{kind}/{id}/image', [ContentAdminController::class, 'image'])->whereIn('kind', ['events', 'articles']);
        Route::post('/content/{kind}/{id}/{action}', [ContentAdminController::class, 'transition'])->whereIn('kind', ['events', 'articles'])->whereIn('action', ['publish', 'unpublish', 'schedule']);
        Route::delete('/content/{kind}/{id}', [ContentAdminController::class, 'destroy'])->whereIn('kind', ['events', 'articles']);
        Route::get('/article-categories', [ContentAdminController::class, 'categories']);
        Route::post('/article-categories', [ContentAdminController::class, 'storeCategory']);
        Route::get('/testimonials', [ContentAdminController::class, 'testimonials']);
        Route::post('/testimonials', [ContentAdminController::class, 'storeTestimonial']);
        Route::patch('/testimonials/{testimonial}', [ContentAdminController::class, 'updateTestimonial']);
        Route::delete('/testimonials/{testimonial}', [ContentAdminController::class, 'destroyTestimonial']);
        Route::get('/messages', [ContentAdminController::class, 'messages']);
        Route::post('/messages/{message}/handled', [ContentAdminController::class, 'markMessageHandled']);
        Route::get('/newsletter', [ContentAdminController::class, 'subscribers']);

        Route::get('/settings', [SettingsAdminController::class, 'show']);
        Route::put('/settings', [SettingsAdminController::class, 'update']);
        Route::put('/settings/social-links', [SettingsAdminController::class, 'socialLinks']);
        Route::put('/settings/content/{key}', [SettingsAdminController::class, 'content']);

        Route::get('/bank-accounts', [BankAccountAdminController::class, 'index']);
        Route::post('/bank-accounts', [BankAccountAdminController::class, 'store']);
        Route::patch('/bank-accounts/{bankAccount}', [BankAccountAdminController::class, 'update']);

        Route::get('/payments', [PaymentAdminController::class, 'index']);
        Route::get('/payments/{payment}', [PaymentAdminController::class, 'show']);
        Route::get('/payments/{payment}/proofs/{proof}', [PaymentAdminController::class, 'proof'])->whereNumber('proof');
        Route::post('/payments/{payment}/verify', [PaymentAdminController::class, 'verify']);
        Route::post('/payments/{payment}/reject', [PaymentAdminController::class, 'reject']);
        Route::post('/payments/{payment}/exception', [PaymentAdminController::class, 'exception']);
        Route::post('/payments/{payment}/resolve', [PaymentAdminController::class, 'resolve']);

        Route::get('/refunds', [RefundAdminController::class, 'index']);
        Route::post('/refunds/{refund}/deny', [RefundAdminController::class, 'deny']);
        Route::post('/refunds/{refund}/pay', [RefundAdminController::class, 'pay']);

        Route::post('/tickets/validate', [TicketAdminController::class, 'validateTicket'])->middleware('throttle:scanner');
        Route::get('/tickets/recent', [TicketAdminController::class, 'recent']);
        Route::post('/scanner/pairs', [ScannerPairController::class, 'create']);
        Route::get('/scanner/pairs/{token}/events', [ScannerPairController::class, 'events']);
        Route::delete('/scanner/pairs/{token}', [ScannerPairController::class, 'destroy']);

        Route::get('/showtimes', [ShowtimeAdminController::class, 'index']);
        Route::post('/showtimes', [ShowtimeAdminController::class, 'store']);
        Route::post('/showtimes/bulk', [ShowtimeAdminController::class, 'storeMany']);
        Route::post('/showtimes/bulk-delete', [ShowtimeAdminController::class, 'destroyMany']);
        Route::post('/showtimes/bulk-publish', [ShowtimeAdminController::class, 'publishMany']);
        Route::get('/showtimes/{showtime}', [ShowtimeAdminController::class, 'show']);
        Route::get('/showtimes/{showtime}/seats', [ShowtimeAdminController::class, 'seats']);
        Route::patch('/showtimes/{showtime}', [ShowtimeAdminController::class, 'update']);
        Route::put('/showtimes/{showtime}/prices', [ShowtimeAdminController::class, 'prices']);
        Route::post('/showtimes/{showtime}/publish', [ShowtimeAdminController::class, 'publish']);
        Route::post('/showtimes/{showtime}/cancel', [ShowtimeAdminController::class, 'cancel']);
        Route::delete('/showtimes/{showtime}', [ShowtimeAdminController::class, 'destroy']);
    });
});
