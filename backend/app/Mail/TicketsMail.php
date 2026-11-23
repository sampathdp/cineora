<?php

namespace App\Mail;

use App\Enums\TicketStatus;
use App\Models\Booking;
use App\Services\Ticket\TicketIssuanceService;
use chillerlan\QRCode\Output\QRGdImagePNG;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Sent once payment is verified: one QR code per seat, embedded inline (CID) so mail clients that block data: URIs
 * still show them. The QR encodes the same opaque token as the ticket page, nothing personal.
 */
class TicketsMail extends Mailable
{
    public function __construct(public readonly Booking $booking, public readonly string $ticketsUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your tickets are ready ({$this->booking->reference})");
    }

    public function content(): Content
    {
        $booking = $this->booking->loadMissing('tickets.bookingSeat', 'showtime.movie', 'showtime.cinema', 'showtime.room');
        $showtime = $booking->showtime;
        $timezone = $showtime->cinema->timezone ?: config('app.timezone');

        $tickets = $booking->tickets
            ->filter(fn ($t) => $t->status === TicketStatus::Valid && $t->qr_token_encrypted)
            ->map(fn ($t) => [
                'seat' => $t->bookingSeat->seat_label,
                'category' => $t->bookingSeat->category_name,
                'reference' => $t->public_id,
                'png' => self::qrPng(TicketIssuanceService::qrPayload($t->qr_token_encrypted)),
            ])->values();

        return new Content(view: 'mail.tickets', text: 'mail.tickets-text', with: [
            'booking' => $booking,
            'movie' => $showtime->movie->title,
            'cinema' => $showtime->cinema->name,
            'room' => $showtime->room->name,
            'startsAt' => $showtime->starts_at->copy()->setTimezone($timezone)->format('D j M Y, g:i A'),
            'tickets' => $tickets,
            'ticketsUrl' => $this->ticketsUrl,
        ]);
    }

    public static function qrPng(string $data): string
    {
        $options = new QROptions(['outputInterface' => QRGdImagePNG::class, 'outputBase64' => false, 'scale' => 8, 'quietzoneSize' => 2]);

        return (new QRCode($options))->render($data);
    }
}
