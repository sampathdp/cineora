<?php

namespace Database\Factories;

use App\Models\BankAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BankAccount> */
class BankAccountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'bank_name' => 'Test Bank',
            'account_name' => 'Cineora Test',
            'account_number' => '000-000-000000',
            'is_active' => true,
        ];
    }
}
