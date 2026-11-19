<?php

namespace App\Services\Booking;

use App\Exceptions\DomainConflictException;

/** Some requested seats were taken (or are not sellable). Rendered as 409 with the offending seat labels. */
class SeatsUnavailableException extends DomainConflictException
{
    /** @param  list<string>  $seats */
    public function __construct(public readonly array $seats)
    {
        parent::__construct('Some of the seats you chose are no longer available: '.implode(', ', $seats).'.', 'seats_unavailable');
    }
}
