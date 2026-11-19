<?php

namespace App\Enums;

enum BookingStatus: string
{
    case PENDING_PAYMENT = 'PENDING_PAYMENT';
    case PAYMENT_REVIEW = 'PAYMENT_REVIEW';
    case PAYMENT_REJECTED = 'PAYMENT_REJECTED';
    case CONFIRMED = 'CONFIRMED';
    case EXPIRED = 'EXPIRED';
    case CANCELLED = 'CANCELLED';
    case REFUND_PENDING = 'REFUND_PENDING';
    case PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED';
    case REFUNDED = 'REFUNDED';
    case PAYMENT_EXCEPTION = 'PAYMENT_EXCEPTION';

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::PENDING_PAYMENT => [self::PAYMENT_REVIEW, self::EXPIRED, self::CANCELLED],
            self::PAYMENT_REVIEW => [self::CONFIRMED, self::PAYMENT_REJECTED, self::PAYMENT_EXCEPTION],
            self::PAYMENT_REJECTED => [self::PAYMENT_REVIEW, self::EXPIRED, self::CANCELLED],
            self::PAYMENT_EXCEPTION => [self::CONFIRMED, self::CANCELLED, self::REFUND_PENDING],
            self::CONFIRMED => [self::CANCELLED, self::REFUND_PENDING],
            self::REFUND_PENDING => [self::PARTIALLY_REFUNDED, self::REFUNDED, self::CONFIRMED],
            self::PARTIALLY_REFUNDED => [self::REFUNDED, self::REFUND_PENDING],
            self::EXPIRED, self::CANCELLED, self::REFUNDED => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    /** Statuses in which seats stay allocated to the booking. */
    public function holdsSeats(): bool
    {
        return in_array($this, [self::PENDING_PAYMENT, self::PAYMENT_REVIEW, self::PAYMENT_REJECTED, self::PAYMENT_EXCEPTION, self::CONFIRMED, self::REFUND_PENDING, self::PARTIALLY_REFUNDED], true);
    }
}
