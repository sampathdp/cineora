<?php

namespace Tests\Feature\Payment;

use App\Enums\Role;
use App\Models\BankAccount;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Booking\BookingTestCase;

abstract class PaymentTestCase extends BookingTestCase
{
    protected BankAccount $bank;

    protected User $verifier;

    protected User $customer;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        $this->bank = BankAccount::factory()->create(['account_number' => '110-123-456789', 'bank_name' => 'Test Bank', 'cinema_id' => null]);
        $this->verifier = $this->staff(Role::PaymentVerifier);
        $this->verifier->cinemas()->attach($this->cinema);
        $this->verifier->flushAccessCache();
        $this->customer = $this->customer();
    }

    /** A real PNG whose bytes depend on $seed, so two different seeds are two different files. */
    protected function png(int $seed = 1, string $name = 'proof.png'): UploadedFile
    {
        $img = imagecreatetruecolor(240, 160);
        imagefilledrectangle($img, 0, 0, 240, 160, imagecolorallocate($img, ($seed * 37) % 255, ($seed * 91) % 255, ($seed * 53) % 255));
        imagestring($img, 3, 10, 10, "transfer {$seed}", imagecolorallocate($img, 255, 255, 255));
        ob_start();
        imagepng($img);

        return UploadedFile::fake()->createWithContent($name, (string) ob_get_clean());
    }

    protected function reserve(?User $user = null, array $seats = ['A1', 'A2']): Booking
    {
        return Booking::where('public_id', $this->book($user ?? $this->customer, $seats)->assertCreated()->json('data.id'))->firstOrFail();
    }

    protected function submit(Booking $booking, ?User $user = null, array $over = [], ?UploadedFile $file = null)
    {
        return $this->as($user ?? $this->customer)->post("/api/v1/bookings/{$booking->public_id}/payment/proof", array_merge([
            'proof' => $file ?? $this->png(),
            'submitted_amount' => (int) $booking->total,
            'transfer_date' => now()->toDateString(),
            'payer_name' => 'Kim Min Jun',
        ], $over), ['Accept' => 'application/json']);
    }

    /** Reserve, then submit a valid proof so the booking is waiting in the review queue. */
    protected function inReview(?User $user = null, array $seats = ['A1', 'A2'], int $seed = 1): array
    {
        $booking = $this->reserve($user, $seats);
        $this->submit($booking, $user, [], $this->png($seed))->assertCreated();
        $booking->refresh();
        $payment = $booking->payments()->latest('id')->first();

        return [$booking, $payment];
    }
}
