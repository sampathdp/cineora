<?php

namespace App\Services\Ticket;

use App\Enums\BookingStatus;
use App\Enums\TicketStatus;
use App\Exceptions\DomainConflictException;
use App\Models\Booking;
use App\Models\Ticket;
use Illuminate\Support\Collection;

/**
 * Turns a confirmed booking into one ticket per seat.
 *
 * Tickets are only ever created from here, and only for a CONFIRMED booking, which in turn is only reachable
 * through server-side payment verification. Each ticket gets a 256-bit random token: the SHA-256 of it is stored
 * for lookup (so a database leak does not reveal usable tokens) and the raw token is kept encrypted only so the
 * owner's QR code can be drawn again later.
 */
class TicketIssuanceService
{
    public const QR_PREFIX = 'CINEORA1:';

    /** @return Collection<int, Ticket> */
    public function issue(Booking $booking): Collection
    {
        if ($booking->status !== BookingStatus::CONFIRMED) {
            throw new DomainConflictException('Tickets can only be issued for confirmed bookings.', 'not_confirmed');
        }

        $existing = Ticket::where('booking_id', $booking->id)->pluck('booking_seat_id')->flip();
        $issued = collect();
        foreach ($booking->seats()->get() as $seat) {
            if ($existing->has($seat->id)) {
                continue; // issuing twice must not create a second ticket for a seat
            }
            $raw = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
            $ticket = new Ticket(['booking_id' => $booking->id, 'booking_seat_id' => $seat->id, 'showtime_id' => $booking->showtime_id, 'token_hash' => self::hash($raw), 'issued_at' => now()]);
            $ticket->status = TicketStatus::Valid;
            $ticket->qr_token_encrypted = $raw;
            $ticket->save();
            $issued->push($ticket);
        }

        return $issued;
    }

    public static function hash(string $rawToken): string
    {
        return hash('sha256', $rawToken);
    }

    /** What the QR code encodes: an opaque prefix plus the random token, nothing personal. */
    public static function qrPayload(string $rawToken): string
    {
        return self::QR_PREFIX.$rawToken;
    }

    /** Accepts scanner output with or without the prefix; returns null for anything that cannot be a token. */
    public static function parseQr(string $scanned): ?string
    {
        $value = trim($scanned);
        if (str_starts_with($value, self::QR_PREFIX)) {
            $value = substr($value, strlen(self::QR_PREFIX));
        }

        return preg_match('/^[A-Za-z0-9_\-]{40,50}$/', $value) ? $value : null;
    }
}
