<?php

namespace App\Http\Resources;

use App\Services\Media\SecureUploadService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Cinema */
class CinemaResource extends JsonResource
{
    protected function isAdmin(): bool
    {
        return false;
    }

    public function toArray(Request $request): array
    {
        $uploads = app(SecureUploadService::class);

        return [
            'id' => $this->public_id,
            'slug' => $this->slug,
            'name' => $this->name,
            'area' => $this->area,
            'address' => $this->address,
            'phone' => $this->phone,
            'email' => $this->email,
            'description' => $this->description,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'art_theme' => $this->art_theme,
            'facilities' => $this->whenLoaded('facilities', fn () => $this->facilities->sortBy('id')->pluck('name')->values()),
            'images' => $this->whenLoaded('images', fn () => $this->images->sortBy('sort_order')->map(
                fn ($i) => ['id' => $i->id, 'url' => $uploads->url($i->path), 'alt' => $i->alt],
            )->values()),
            'rooms' => $this->whenLoaded('rooms', fn () => $this->rooms
                ->when(! $this->isAdmin(), fn ($rooms) => $rooms->where('is_active', true))
                ->map(fn ($r) => [
                    'id' => $r->public_id,
                    'name' => $r->name,
                    'screen_type' => $r->screen_type,
                    'is_active' => (bool) $r->is_active,
                    'seat_count' => $r->seats_count ?? null,
                ])->values()),
            $this->mergeWhen($this->isAdmin(), fn () => ['is_active' => $this->is_active]),
        ];
    }
}
