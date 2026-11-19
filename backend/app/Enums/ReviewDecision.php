<?php

namespace App\Enums;

enum ReviewDecision: string
{
    case Verified = 'verified';
    case Rejected = 'rejected';
    case Exception = 'exception';
}
