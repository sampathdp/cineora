<?php

namespace App\Http\Resources;

use App\Services\Ticket\TicketIssuanceService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A customer's own ticket. The QR payload (token) is included only here, only for the owner, and only while the
 * ticket can still be presented.
 *
 * @mixin \App\Models\Ticket
 */
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $showtime = $this->showtime;
        $presentable = in_array($this->status->value, ['valid', 'used'], true);

        return [
            'id' => $this->public_id,
            'reference' => $this->public_id,
            'status' => $this->status->value,
            'seat' => $this->bookingSeat->seat_label,
            'category' => $this->bookingSeat->category_name,
            'booking' => ['id' => $this->booking->public_id, 'reference' => $this->booking->reference],
            'movie' => ['slug' => $showtime->movie->slug, 'title' => $showtime->movie->title],
            'cinema' => ['name' => $showtime->cinema->name, 'timezone' => $showtime->cinema->timezone],
            'room' => $showtime->room->name,
            'starts_at' => $showtime->starts_at->copy()->utc()->toIso8601String(),
            'issued_at' => $this->issued_at->copy()->utc()->toIso8601String(),
            'used_at' => $this->used_at?->copy()->utc()->toIso8601String(),
            'qr' => $presentable && $this->qr_token_encrypted ? TicketIssuanceService::qrPayload($this->qr_token_encrypted) : null,
        ];
    }
}
