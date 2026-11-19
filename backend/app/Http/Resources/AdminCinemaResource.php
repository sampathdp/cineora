<?php

namespace App\Http\Resources;

class AdminCinemaResource extends CinemaResource
{
    protected function isAdmin(): bool
    {
        return true;
    }
}
