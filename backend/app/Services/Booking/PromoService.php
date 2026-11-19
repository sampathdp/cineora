<?php

namespace App\Services\Booking;

use App\Enums\PromoType;
use App\Models\Booking;
use App\Models\PromoCode;
use App\Models\PromoRedemption;
use App\Models\Showtime;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Server-side discount rules. Whole-won arithmetic; the client never supplies an amount. */
class PromoService
{
    /**
     * Validates a code for this purchase and returns the promo (row-locked) with the discount in won.
     * Must run inside the booking transaction so usage limits cannot be overshot concurrently.
     *
     * @return array{0: PromoCode, 1: int}
     */
    public function evaluate(string $code, User $user, Showtime $showtime, int $subtotal): array
    {
        $promo = PromoCode::query()->whereRaw('LOWER(code) = ?', [mb_strtolower(trim($code))])->lockForUpdate()->first();
        $invalid = fn (string $why) => ValidationException::withMessages(['promo_code' => [$why]]);

        if (! $promo || ! $promo->is_active) {
            throw $invalid('This promo code is not valid.');
        }
        if (($promo->starts_at && now()->lt($promo->starts_at)) || ($promo->ends_at && now()->gt($promo->ends_at))) {
            throw $invalid('This promo code is not valid right now.');
        }
        if ($subtotal < (int) $promo->min_amount) {
            throw $invalid('The order is below the minimum amount for this code.');
        }
        if ($promo->usage_limit !== null && $promo->used_count >= $promo->usage_limit) {
            throw $invalid('This promo code has been fully redeemed.');
        }
        if ($promo->per_user_limit !== null && PromoRedemption::where('promo_code_id', $promo->id)->where('user_id', $user->id)->count() >= $promo->per_user_limit) {
            throw $invalid('You have already used this promo code.');
        }
        if ($promo->movies()->exists() && ! $promo->movies()->whereKey($showtime->movie_id)->exists()) {
            throw $invalid('This promo code does not apply to this movie.');
        }
        if ($promo->cinemas()->exists() && ! $promo->cinemas()->whereKey($showtime->cinema_id)->exists()) {
            throw $invalid('This promo code does not apply to this cinema.');
        }

        $raw = $promo->type === PromoType::Percent ? intdiv($subtotal * (int) $promo->value, 100) : (int) $promo->value;
        if ($promo->max_discount !== null) {
            $raw = min($raw, (int) $promo->max_discount);
        }

        return [$promo, max(0, min($raw, $subtotal))];
    }

    public function redeem(PromoCode $promo, User $user, Booking $booking, int $amount): void
    {
        PromoRedemption::create(['promo_code_id' => $promo->id, 'user_id' => $user->id, 'booking_id' => $booking->id, 'amount' => $amount]);
        $promo->increment('used_count');
    }

    /** Gives the usage back when a booking never completes. Idempotent. */
    public function release(Booking $booking): void
    {
        $redemption = PromoRedemption::where('booking_id', $booking->id)->lockForUpdate()->first();
        if (! $redemption) {
            return;
        }
        DB::table('promo_codes')->where('id', $redemption->promo_code_id)->where('used_count', '>', 0)->decrement('used_count');
        $redemption->delete();
    }
}
