<?php

namespace App\Http\Resources;

class AdminMovieResource extends MovieResource
{
    protected function isAdmin(): bool
    {
        return true;
    }
}
