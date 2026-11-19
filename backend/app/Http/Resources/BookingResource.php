<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Booking */
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $showtime = $this->whenLoaded('showtime');

        return [
            'id' => $this->public_id,
            'reference' => $this->reference,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'subtotal' => (int) $this->subtotal,
            'discount' => (int) $this->discount,
            'fee' => (int) $this->fee,
            'total' => (int) $this->total,
            // Absolute server timestamps: the browser countdown is informational, expiry is decided here.
            'hold_expires_at' => $this->hold_expires_at->copy()->utc()->toIso8601String(),
            'payment_deadline_at' => $this->payment_deadline_at->copy()->utc()->toIso8601String(),
            'created_at' => $this->created_at?->copy()->utc()->toIso8601String(),
            'confirmed_at' => $this->confirmed_at?->copy()->utc()->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->copy()->utc()->toIso8601String(),
            'seats' => $this->whenLoaded('seats', fn () => $this->seats->sortBy('seat_label', SORT_NATURAL)->map(fn ($s) => [
                'label' => $s->seat_label, 'category' => $s->category_name, 'unit_price' => (int) $s->unit_price,
            ])->values()),
            'showtime' => $this->when($this->relationLoaded('showtime') && $this->showtime->relationLoaded('movie'), fn () => [
                'id' => $this->showtime->public_id,
                'starts_at' => $this->showtime->starts_at->copy()->utc()->toIso8601String(),
                'movie' => ['slug' => $this->showtime->movie->slug, 'title' => $this->showtime->movie->title],
                'cinema' => ['name' => $this->showtime->cinema->name, 'timezone' => $this->showtime->cinema->timezone],
                'room' => ['name' => $this->showtime->room->name],
            ]),
        ];
    }
}
