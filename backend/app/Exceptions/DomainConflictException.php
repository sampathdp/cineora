<?php

namespace App\Exceptions;

use RuntimeException;

/** A valid request that conflicts with the current state of the data (rendered as HTTP 409). */
class DomainConflictException extends RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode = 'conflict')
    {
        parent::__construct($message);
    }
}
