<?php

namespace App\Http\Resources;

class AdminShowtimeResource extends ShowtimeResource
{
    protected function isAdmin(): bool
    {
        return true;
    }
}
