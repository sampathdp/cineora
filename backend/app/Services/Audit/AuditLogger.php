<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Request;

/**
 * Writes append-only audit entries. Metadata is filtered through a deny list so credentials,
 * tokens, payment details and proofs can never be stored by accident.
 */
class AuditLogger
{
    private const DENIED_KEYS = [
        'password', 'current_password', 'password_confirmation', 'token', 'secret', 'code', 'recovery_code',
        'recovery_codes', 'mfa_secret', 'account_number', 'authorization', 'cookie', 'session', 'qr', 'proof', 'otp',
    ];

    public function log(string $action, ?User $actor = null, ?string $resourceType = null, string|int|null $resourceId = null, array $metadata = []): void
    {
        $request = app()->runningInConsole() ? null : request();

        AuditLog::create([
            'actor_id' => $actor?->getKey(),
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId !== null ? (string) $resourceId : null,
            'metadata' => $metadata === [] ? null : $this->scrub($metadata),
            'ip' => $request?->ip(),
            'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 255) : null,
            'correlation_id' => $request?->attributes->get('correlation_id'),
        ]);
    }

    /** Short, non-reversible marker for correlating attempts without storing the address. */
    public static function fingerprint(string $value): string
    {
        return substr(hash('sha256', mb_strtolower(trim($value))), 0, 16);
    }

    private function scrub(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(mb_strtolower($key), self::DENIED_KEYS, true)) {
                continue;
            }
            $clean[$key] = is_array($value) ? $this->scrub($value) : $value;
        }

        return $clean;
    }
}
