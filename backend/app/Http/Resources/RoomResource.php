<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ScreeningRoom */
class RoomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_id,
            'name' => $this->name,
            'screen_type' => $this->screen_type,
            'is_active' => $this->is_active,
            'seat_count' => $this->whenCounted('seats'),
            'seats' => $this->whenLoaded('seats', fn () => $this->seats
                ->sortBy([['row_label', 'asc'], ['number', 'asc']])
                ->map(fn ($s) => [
                    'row_label' => $s->row_label,
                    'number' => $s->number,
                    'category_key' => $s->category->key ?? null,
                    'x' => $s->x,
                    'y' => $s->y,
                    'is_active' => $s->is_active,
                ])->values()),
        ];
    }
}
