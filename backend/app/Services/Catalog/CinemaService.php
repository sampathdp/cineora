<?php

namespace App\Services\Catalog;

use App\Exceptions\DomainConflictException;
use App\Models\BankAccount;
use App\Models\Cinema;
use App\Models\CinemaImage;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Media\SecureUploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CinemaService
{
    public const IMAGE_DIRS = ['cinemas'];

    private const SCALARS = ['name', 'area', 'address', 'phone', 'email', 'description', 'timezone', 'is_active', 'art_theme'];

    public function __construct(private readonly AuditLogger $audit, private readonly SecureUploadService $uploads, private readonly RoomService $rooms) {}

    /**
     * Permanently deletes a cinema with its halls, seats, showtimes, images, facilities, seat tiers, staff
     * assignments and cinema-specific bank accounts. Refused once any booking exists for the cinema.
     */
    public function delete(Cinema $cinema, User $actor): void
    {
        $paths = DB::transaction(function () use ($cinema, $actor) {
            Cinema::whereKey($cinema->id)->lockForUpdate()->first();
            if (DB::table('bookings')->where('cinema_id', $cinema->id)->exists()) {
                throw new DomainConflictException('This cinema has bookings. Deactivate it instead of deleting.', 'has_bookings');
            }

            foreach ($cinema->rooms()->withTrashed()->get() as $room) {
                $this->rooms->purge($room);
            }
            if (DB::table('payments')->whereIn('bank_account_id', BankAccount::where('cinema_id', $cinema->id)->select('id'))->exists()) {
                throw new DomainConflictException('A bank account of this cinema has payments. Deactivate the cinema instead.', 'has_payments');
            }
            BankAccount::where('cinema_id', $cinema->id)->delete();
            // Scan logs keep their history without the cinema link.
            DB::table('ticket_validation_events')->where('cinema_id', $cinema->id)->update(['cinema_id' => null]);

            $paths = $cinema->images()->pluck('path')->all();
            $cinema->forceDelete(); // facilities, images, seat tiers, staff assignments and promo links cascade
            $this->audit->log('cinema.deleted', $actor, 'cinema', $cinema->public_id, ['name' => $cinema->name]);

            return $paths;
        });

        foreach ($paths as $path) {
            $this->uploads->delete($path, self::IMAGE_DIRS);
        }
    }

    public function save(array $data, User $actor, ?Cinema $cinema = null): Cinema
    {
        return DB::transaction(function () use ($data, $actor, $cinema) {
            $creating = $cinema === null;
            $cinema ??= new Cinema(['currency' => config('cineora.currency'), 'timezone' => config('cineora.timezone'), 'is_active' => true]);
            $cinema->fill(array_intersect_key($data, array_flip(self::SCALARS)));
            if ($creating) {
                $cinema->slug = $this->uniqueSlug($data['slug'] ?? $cinema->name);
            }
            $cinema->save();

            if (array_key_exists('facilities', $data)) {
                $cinema->facilities()->delete();
                foreach (array_unique($data['facilities'] ?? []) as $name) {
                    $cinema->facilities()->create(['name' => $name]);
                }
            }
            $this->audit->log($creating ? 'cinema.created' : 'cinema.updated', $actor, 'cinema', $cinema->public_id, ['fields' => array_keys($data)]);

            return $cinema->load($this->relations());
        });
    }

    public function addImage(Cinema $cinema, UploadedFile $file, ?string $alt, User $actor): Cinema
    {
        $path = $this->uploads->storeImage($file, 'cinemas/'.$cinema->public_id);
        $cinema->images()->create(['path' => $path, 'alt' => $alt, 'sort_order' => $cinema->images()->count()]);
        $this->audit->log('cinema.image_added', $actor, 'cinema', $cinema->public_id);

        return $cinema->load($this->relations());
    }

    public function removeImage(Cinema $cinema, CinemaImage $image, User $actor): Cinema
    {
        abort_unless($image->cinema_id === $cinema->id, 404);
        $this->uploads->delete($image->path, self::IMAGE_DIRS);
        $image->delete();
        $this->audit->log('cinema.image_removed', $actor, 'cinema', $cinema->public_id);

        return $cinema->load($this->relations());
    }

    public function relations(): array
    {
        return ['facilities', 'images', 'rooms' => fn ($q) => $q->withCount('seats')];
    }

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'cinema';
        $slug = $base;
        $i = 2;
        while (Cinema::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
