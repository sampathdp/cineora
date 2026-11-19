<?php

namespace App\Services\Ticket;

use App\Enums\BookingStatus;
use App\Enums\TicketStatus;
use App\Enums\ValidationOutcome;
use App\Models\Showtime;
use App\Models\Ticket;
use App\Models\TicketValidationEvent;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Door check. The decisive step is a single conditional UPDATE (`... WHERE status = 'valid'`) inside a transaction
 * that holds the ticket row lock: whichever scanner commits first gets `valid`, every other scanner sees zero
 * affected rows and is told `already_used`. Every attempt, accepted or not, is logged.
 */
class TicketValidationService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  string|null  $scanned  raw QR content (prefix optional)
     * @param  string|null  $reference  manual fallback: the ticket reference printed on the ticket
     * @param  string|null  $showtimePublicId  the showtime the checker is currently admitting, if they selected one
     * @return array{result: string, message: string, ticket?: array<string, mixed>}
     */
    public function validate(User $checker, ?string $scanned, ?string $reference, ?string $showtimePublicId): array
    {
        $ticket = $this->find($scanned, $reference);
        $fingerprint = $scanned ? substr(TicketIssuanceService::hash((string) TicketIssuanceService::parseQr($scanned)), 0, 8) : null;

        // Unknown tokens and tickets for cinemas this checker does not work at look identical: no information leaks.
        if (! $ticket || ! $checker->canAt(\App\Enums\Permission::TicketsValidate, $ticket->showtime->cinema_id)) {
            return $this->record($checker, null, null, ValidationOutcome::Invalid, $fingerprint, 'This ticket is not valid.');
        }

        return DB::transaction(function () use ($checker, $ticket, $showtimePublicId, $fingerprint) {
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->with(['showtime.movie', 'showtime.room', 'bookingSeat', 'booking'])->firstOrFail();
            $showtime = $locked->showtime;
            $cinemaId = $showtime->cinema_id;

            if ($showtimePublicId !== null && $showtime->public_id !== $showtimePublicId) {
                return $this->record($checker, $locked, $cinemaId, ValidationOutcome::WrongShowtime, $fingerprint, 'This ticket is for a different showtime.');
            }
            $early = $showtime->starts_at->copy()->subMinutes((int) config('cineora.ticket.checkin_opens_minutes_before'));
            if (now()->lt($early) || now()->gt($showtime->ends_at)) {
                return $this->record($checker, $locked, $cinemaId, ValidationOutcome::WrongShowtime, $fingerprint, 'Check-in is not open for this showtime right now.');
            }

            // Anything other than a currently valid ticket on a confirmed booking is refused with a specific reason.
            $blocked = match ($locked->status) {
                TicketStatus::Used => [ValidationOutcome::AlreadyUsed, 'This ticket was already used.'],
                TicketStatus::Cancelled => [ValidationOutcome::Cancelled, 'This ticket was cancelled.'],
                TicketStatus::Refunded => [ValidationOutcome::Refunded, 'This ticket was refunded.'],
                TicketStatus::Void => [ValidationOutcome::Void, 'This ticket is not valid.'],
                TicketStatus::Valid => $locked->booking->status === BookingStatus::CONFIRMED ? null : [ValidationOutcome::Void, 'This ticket is not valid.'],
            };
            if ($blocked) {
                return $this->record($checker, $locked, $cinemaId, $blocked[0], $fingerprint, $blocked[1]);
            }

            $claimed = DB::table('tickets')->where('id', $locked->id)->where('status', TicketStatus::Valid->value)
                ->update(['status' => TicketStatus::Used->value, 'used_at' => now(), 'updated_at' => now()]);
            if ($claimed !== 1) {
                return $this->record($checker, $locked, $cinemaId, ValidationOutcome::AlreadyUsed, $fingerprint, 'This ticket was already used.');
            }

            $locked->checkin()->create(['checker_id' => $checker->id, 'cinema_id' => $cinemaId, 'checked_in_at' => now()]);
            $this->audit->log('ticket.checked_in', $checker, 'ticket', $locked->public_id, ['showtime' => $showtime->public_id]);

            return $this->record($checker, $locked, $cinemaId, ValidationOutcome::Valid, $fingerprint, 'Valid. Admit one.');
        });
    }

    private function find(?string $scanned, ?string $reference): ?Ticket
    {
        if ($scanned !== null && ($token = TicketIssuanceService::parseQr($scanned))) {
            return Ticket::where('token_hash', TicketIssuanceService::hash($token))->with('showtime')->first();
        }
        if ($reference !== null && preg_match('/^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/', trim($reference))) {
            return Ticket::where('public_id', strtoupper(trim($reference)))->with('showtime')->first();
        }

        return null;
    }

    /** @return array{result: string, message: string, ticket?: array<string, mixed>} */
    private function record(User $checker, ?Ticket $ticket, ?int $cinemaId, ValidationOutcome $outcome, ?string $fingerprint, string $message): array
    {
        TicketValidationEvent::create([
            'ticket_id' => $ticket?->id, 'checker_id' => $checker->id, 'cinema_id' => $cinemaId,
            'outcome' => $outcome, 'token_fingerprint' => $fingerprint,
        ]);

        $out = ['result' => $outcome->value, 'message' => $message];
        if ($ticket && $outcome !== ValidationOutcome::Invalid) {
            // Only what the doorkeeper needs. No customer name, email, payment or price.
            $showtime = $ticket->showtime;
            $out['ticket'] = [
                'reference' => $ticket->public_id,
                'seat' => $ticket->bookingSeat->seat_label,
                'category' => $ticket->bookingSeat->category_name,
                'movie' => $showtime->movie->title,
                'starts_at' => $showtime->starts_at->copy()->utc()->toIso8601String(),
                'room' => $showtime->room->name,
                'checked_in_at' => $outcome === ValidationOutcome::AlreadyUsed ? $ticket->checkin?->checked_in_at?->copy()->utc()->toIso8601String() ?? $ticket->used_at?->copy()->utc()->toIso8601String() : null,
            ];
        }

        return $out;
    }
}
