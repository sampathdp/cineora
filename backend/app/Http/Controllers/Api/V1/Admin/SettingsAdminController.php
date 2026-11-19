<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\SiteContent;
use App\Models\SiteSetting;
use App\Models\SocialLink;
use App\Services\Audit\AuditLogger;
use App\Services\Content\ContentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Website content that used to live in source code: contact details, social links and the About/Terms/Privacy texts.
 * Only an allow-listed set of keys can be written, so this cannot be used to alter security-relevant configuration.
 */
class SettingsAdminController extends Controller
{
    /** key => validation rules. All of these are public by design (they appear on the website). */
    public const SETTINGS = [
        'site.name' => ['string', 'max:60'],
        'site.tagline' => ['string', 'max:120'],
        'site.description' => ['string', 'max:300'],
        'contact.email' => ['email:rfc', 'max:255'],
        'contact.phone' => ['string', 'max:32', 'regex:/^[0-9+\-\s()]{6,32}$/'],
        'contact.address' => ['string', 'max:255'],
        'contact.hours' => ['string', 'max:160'],
    ];

    public const CONTENT_KEYS = ['about', 'terms', 'privacy'];

    public const PLATFORMS = ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok'];

    public function __construct(private readonly AuditLogger $audit) {}

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission(Permission::SettingsManage), 403);
    }

    public function show(Request $request): JsonResponse
    {
        $this->guard($request);

        return ApiResponse::success([
            'settings' => SiteSetting::whereIn('key', array_keys(self::SETTINGS))->pluck('value', 'key'),
            'social_links' => SocialLink::orderBy('sort_order')->get(['platform', 'url']),
            'content' => SiteContent::where('locale', 'en')->whereIn('key', self::CONTENT_KEYS)->pluck('body', 'key'),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->guard($request);
        $rules = ['values' => ['required', 'array']];
        foreach (self::SETTINGS as $key => $rule) {
            // Keys contain dots ("contact.email"): escape them so they are matched literally, not as nested paths.
            $rules['values.'.str_replace('.', '\.', $key)] = ['sometimes', 'nullable', ...$rule];
        }
        $v = $request->validate($rules);
        // Anything outside the allow-list is an error, never silently stored.
        $unknown = array_diff(array_keys((array) $request->input('values', [])), array_keys(self::SETTINGS));
        if ($unknown !== []) {
            throw \Illuminate\Validation\ValidationException::withMessages(['values' => ['Unknown setting: '.implode(', ', $unknown).'.']]);
        }

        $changed = [];
        foreach ($v['values'] ?? [] as $key => $value) {
            $value = $value === null ? null : ContentService::plain($value, 300);
            SiteSetting::updateOrCreate(['key' => $key], ['value' => $value, 'is_public' => true]);
            $changed[] = $key;
        }
        $this->audit->log('settings.updated', $request->user(), 'settings', null, ['keys' => $changed]);

        return $this->show($request);
    }

    public function socialLinks(Request $request): JsonResponse
    {
        $this->guard($request);
        $v = $request->validate([
            'links' => ['required', 'array', 'max:10'],
            'links.*.platform' => ['required', 'in:'.implode(',', self::PLATFORMS), 'distinct'],
            'links.*.url' => ['required', 'url:https', 'max:512'],
        ]);
        DB::transaction(function () use ($v) {
            SocialLink::query()->delete();
            foreach (array_values($v['links']) as $i => $l) {
                SocialLink::create(['platform' => $l['platform'], 'url' => $l['url'], 'sort_order' => $i]);
            }
        });
        $this->audit->log('settings.social_links_updated', $request->user(), 'settings', null, ['count' => count($v['links'])]);

        return $this->show($request);
    }

    public function content(Request $request, string $key): JsonResponse
    {
        $this->guard($request);
        abort_unless(in_array($key, self::CONTENT_KEYS, true), 404);
        $v = $request->validate(['body' => ['required', 'string', 'max:50000']]);
        SiteContent::updateOrCreate(['key' => $key, 'locale' => 'en'], ['body' => ContentService::plain($v['body'], 50000)]);
        $this->audit->log('settings.content_updated', $request->user(), 'site_content', $key);

        return $this->show($request);
    }
}
