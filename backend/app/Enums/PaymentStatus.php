<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case AWAITING_TRANSFER = 'AWAITING_TRANSFER';
    case PROOF_SUBMITTED = 'PROOF_SUBMITTED';
    case UNDER_REVIEW = 'UNDER_REVIEW';
    case VERIFIED = 'VERIFIED';
    case REJECTED = 'REJECTED';
    case EXPIRED = 'EXPIRED';
    case EXCEPTION = 'EXCEPTION';
    case REFUND_PENDING = 'REFUND_PENDING';
    case PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED';
    case REFUNDED = 'REFUNDED';

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::AWAITING_TRANSFER => [self::PROOF_SUBMITTED, self::EXPIRED],
            self::PROOF_SUBMITTED => [self::UNDER_REVIEW, self::VERIFIED, self::REJECTED, self::EXCEPTION],
            self::UNDER_REVIEW => [self::VERIFIED, self::REJECTED, self::EXCEPTION],
            self::EXCEPTION => [self::VERIFIED, self::REJECTED, self::REFUND_PENDING],
            self::VERIFIED => [self::REFUND_PENDING],
            self::REFUND_PENDING => [self::PARTIALLY_REFUNDED, self::REFUNDED, self::VERIFIED],
            self::PARTIALLY_REFUNDED => [self::REFUNDED, self::REFUND_PENDING],
            self::REJECTED, self::EXPIRED, self::REFUNDED => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }
}
