<?php

namespace App\Enums;

enum MovieStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
