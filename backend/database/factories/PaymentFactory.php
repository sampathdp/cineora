<?php

namespace Database\Factories;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Payment> */
class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'booking_id' => \App\Models\Booking::factory(),
            'payment_reference' => strtoupper(fake()->unique()->bothify('PAY-########')),
            'bank_account_id' => \App\Models\BankAccount::factory(),
            'expected_amount' => 24000,
            'status' => 'AWAITING_TRANSFER',
        ];
    }
}
