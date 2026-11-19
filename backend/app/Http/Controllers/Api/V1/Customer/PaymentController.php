<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\PaymentProof;
use App\Services\Payment\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Bank-transfer instructions and proof upload for the customer's own booking. */
class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function show(Request $request, string $booking): JsonResponse
    {
        $b = $this->owned($request, $booking);
        $payment = $this->payments->livePayment($b);
        if (! $payment && in_array($b->status, [BookingStatus::PENDING_PAYMENT, BookingStatus::PAYMENT_REJECTED], true)) {
            $payment = $this->payments->ensurePayment($b);
        }

        return ApiResponse::success($payment ? (new PaymentResource($payment->load(['booking', 'bankAccount', 'proofs', 'reviews'])))->resolve() : null);
    }

    public function submit(Request $request, string $booking): JsonResponse
    {
        $b = $this->owned($request, $booking);
        $data = $request->validate([
            'proof' => ['required', 'file', 'max:'.config('uploads.proof.max_kb')],
            'submitted_amount' => ['required', 'integer', 'between:1,100000000'],
            'transfer_date' => ['required', 'date_format:Y-m-d'],
            'payer_name' => ['nullable', 'string', 'max:120'],
        ]);

        $payment = $this->payments->submitProof($b, $request->user(), $data, $request->file('proof'));

        return ApiResponse::success((new PaymentResource($payment->load(['booking', 'bankAccount', 'proofs', 'reviews'])))->resolve(), 'Payment proof received. We will verify it shortly.', status: 201);
    }

    /** The owner can re-open their own proof. Served from private storage; there is no public URL for it. */
    public function proof(Request $request, string $booking, int $proof): StreamedResponse
    {
        $b = $this->owned($request, $booking);
        $file = PaymentProof::whereKey($proof)->whereHas('payment', fn ($q) => $q->where('booking_id', $b->id))->firstOrFail();

        return self::stream($file);
    }

    public static function stream(PaymentProof $file): StreamedResponse
    {
        $isPdf = $file->mime === 'application/pdf';

        return Storage::disk($file->disk)->response($file->path, 'payment-proof.'.($isPdf ? 'pdf' : explode('/', $file->mime)[1]), [
            'Content-Type' => $file->mime,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, no-store',
        ], $isPdf ? 'attachment' : 'inline');
    }

    private function owned(Request $request, string $publicId): Booking
    {
        return Booking::where('public_id', $publicId)->where('user_id', $request->user()->id)->firstOrFail();
    }
}
