<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketValidationEvent extends Model
{
    public $timestamps = false;

    protected $fillable = ['ticket_id', 'checker_id', 'cinema_id', 'outcome', 'token_fingerprint'];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'outcome' => \App\Enums\ValidationOutcome::class,
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checker_id');
    }
}
