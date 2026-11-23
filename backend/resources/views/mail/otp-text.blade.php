================================================================================
CINEORA - VERIFY YOUR EMAIL ADDRESS
================================================================================

Hello{{ !empty($name) ? ' ' . $name : '' }}!

Use this 6-digit verification code to confirm your email address and secure your Cineora account:

   ┌──────────────────────────────┐
   │        {{ $code }}        │
   └──────────────────────────────┘

⏱️ This verification code expires in {{ $ttl ?? 10 }} minutes.

--------------------------------------------------------------------------------
SECURITY NOTICE:
- Never share this code with anyone. Cineora staff will never ask for your code.
- If you did not create an account or request this code, you can safely ignore this email.

Visit Cineora: {{ $frontendUrl ?? 'http://localhost:3000' }}

(c) {{ date('Y') }} Cineora. All rights reserved.
================================================================================
