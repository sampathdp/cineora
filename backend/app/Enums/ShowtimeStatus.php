<?php

namespace App\Enums;

enum ShowtimeStatus: string
{
    case Draft = 'draft';
    case OnSale = 'on_sale';
    case Cancelled = 'cancelled';
    case Completed = 'completed';
}
