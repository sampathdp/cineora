<?php

namespace App\Enums;

enum ValidationOutcome: string
{
    case Valid = 'valid';
    case AlreadyUsed = 'already_used';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';
    case WrongShowtime = 'wrong_showtime';
    case Invalid = 'invalid';
    case Void = 'void';
}
