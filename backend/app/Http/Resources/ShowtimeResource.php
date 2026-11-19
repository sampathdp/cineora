<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Showtime */
class ShowtimeResource extends JsonResource
{
    protected function isAdmin(): bool
    {
        return false;
    }

    public function toArray(Request $request): array
    {
        $prices = $this->relationLoaded('prices')
            ? $this->prices->map(fn ($p) => ['category_key' => $p->category->key, 'category_name' => $p->category->name, 'price' => (int) $p->price])->sortBy('price')->values()
            : null;

        return [
            'id' => $this->public_id,
            'movie' => $this->whenLoaded('movie', fn () => ['slug' => $this->movie->slug, 'title' => $this->movie->title, 'duration_min' => $this->movie->duration_min]),
            'cinema' => $this->whenLoaded('cinema', fn () => ['slug' => $this->cinema->slug, 'name' => $this->cinema->name, 'timezone' => $this->cinema->timezone]),
            'room' => $this->whenLoaded('room', fn () => ['id' => $this->room->public_id, 'name' => $this->room->name, 'screen_type' => $this->room->screen_type]),
            'starts_at' => $this->starts_at->copy()->utc()->toIso8601String(),
            'film_ends_at' => $this->relationLoaded('movie') ? $this->starts_at->copy()->addMinutes($this->movie->duration_min)->utc()->toIso8601String() : null,
            'sales_closes_at' => $this->salesClosesAt()->utc()->toIso8601String(),
            'bookable' => $this->isBookable(),
            'currency' => $this->relationLoaded('cinema') ? $this->cinema->currency : config('cineora.currency'),
            'prices' => $prices,
            'from_price' => $prices?->min('price'),
            'fee_per_seat' => (int) config('cineora.booking.service_fee_per_seat'),
            'available_seats' => $this->when(isset($this->available_seats), fn () => (int) $this->available_seats),
            $this->mergeWhen($this->isAdmin(), fn () => [
                'status' => $this->status->value,
                'sales_cutoff_minutes' => $this->sales_cutoff_minutes,
                'ends_at' => $this->ends_at->copy()->utc()->toIso8601String(),
                'created_at' => $this->created_at?->toIso8601String(),
            ]),
        ];
    }
}
