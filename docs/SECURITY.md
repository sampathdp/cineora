# Security Plan and Threat Model

Status: design (Phase 1). These are planned controls, not verified guarantees. Nothing is implemented or tested yet; later phases must update this document with actual results and remaining risks.

## 1. Assets

Customer accounts and PII; booking/seat inventory integrity; payment proofs (bank statements — sensitive); ticket tokens; staff credentials and sessions; admin capabilities; audit log integrity.

## 2. Actors

Anonymous visitor; authenticated customer; malicious customer (IDOR, price/seat tampering, replay); compromised or over-privileged staff; ticket scanner holders; automated abuse (bots hoarding seats, credential stuffing); network attacker.

## 3. Threats and planned mitigations

| # | Threat | Mitigation |
|---|---|---|
| 1 | Credential stuffing / brute force | Per-account+IP login throttle, generic failure message, identical timing path for unknown email, lockout backoff, audit failures |
| 2 | Account enumeration (login, reset, register) | Generic messages; reset always "if the account exists…"; registration duplicate handled via verification email flow |
| 3 | Session theft / fixation | HttpOnly Secure SameSite=Lax cookies, session regenerate on login, invalidate on logout/password change, DB sessions revocable per user |
| 4 | CSRF | Sanctum CSRF cookie + `X-XSRF-TOKEN`; CORS allowlist; no state change on GET |
| 5 | Privileged account takeover | TOTP MFA required for staff roles in production; recovery codes hashed; MFA secret encrypted; re-auth for sensitive changes |
| 6 | IDOR / cross-customer access | Policies on every model route; queries scoped by owner; public identifiers are ULIDs/references; tests for cross-access |
| 7 | Cross-cinema staff access | Permission + `staff_cinema_assignments` scope applied in policies and query scopes; tests per module |
| 8 | Privilege escalation | Cannot assign roles/permissions you do not hold; only super admin edits roles; last super admin protected; role changes audited |
| 9 | Price manipulation | Prices read from `showtime_seats`/`showtime_seat_prices` inside the transaction; request body prices ignored (and rejected by validation if sent) |
| 10 | Double booking / races | Row locks in fixed order + unique active-allocation constraints; tested with parallel requests on MySQL |
| 11 | Duplicate booking on retry | `Idempotency-Key` + `UNIQUE(user_id,key)`; request hash mismatch → 422 |
| 12 | Seat hoarding | Per-user limit on active unpaid bookings, max seats per booking, rate limits, short hold, expiry job |
| 13 | Fraudulent / forged payment proof | Human verification only by `payments.verify`; amount/reference matching shown to reviewer; hash of proof to detect reuse across bookings; duplicate payment_reference rejected |
| 14 | Verifier self-approval, double verification | Submitter ≠ reviewer check; row lock + status precondition; append-only reviews; verified payments immutable |
| 15 | Late/mismatched payment | Explicit `PAYMENT_EXCEPTION` workflow; no auto-ticket after seats released |
| 16 | Malicious upload (webshell, polyglot, zip bomb, SVG XSS) | Sniffed MIME allowlist (JPEG/PNG/WebP; PDF for proofs), decode and re-encode images, size and dimension caps, random names, private disk for proofs, no SVG uploads, `nosniff`, no execution path; AV scanning recommended in production |
| 17 | Payment proof disclosure | Private disk, authorized download route + short-lived signed URL, never in public listings, audited access |
| 18 | QR guessing / forgery | 256-bit random token, only SHA-256 stored, constant-time lookup by hash, QR carries token only |
| 19 | Double entry with two scanners | Conditional atomic update; outcome from affected rows; unique `ticket_checkins.ticket_id` |
| 20 | Scanner abuse (enumeration of tickets) | Checker rate limit, minimal data returned (seat, movie, time, status), cinema scope enforced, all attempts logged |
| 21 | SQL injection | Eloquent/query builder bindings only; no raw string interpolation (lint rule/review); DB account least privilege |
| 22 | XSS | React escaping; no `dangerouslySetInnerHTML` except sanitized rich text from allowlist; CSP; JSON responses only |
| 23 | Mass assignment | Explicit `$fillable`, FormRequest `validated()` only; tests |
| 24 | Open redirect | Redirect targets validated against allowlisted relative paths |
| 25 | SSRF/URL abuse via trailer URLs | Host allowlist; never fetched server-side |
| 26 | Information leakage in errors/logs | Production `APP_DEBUG=false`, generic 5xx body with correlation id; log scrubbing of passwords, tokens, proofs, QR tokens, cookies |
| 27 | Spam via contact/newsletter | Rate limit, honeypot/CAPTCHA option, validation, no HTML in messages |
| 28 | Dependency vulnerabilities | `composer audit`, `npm audit`, lockfiles committed, scheduled updates |
| 29 | Secrets in repo | `.env*` ignored (with `!.env.example`), placeholders only, secret scanning pre-commit recommended |
| 30 | Audit tampering | Append-only usage; DB user without UPDATE/DELETE on audit tables recommended in production |

## 4. Authorization model

- Permission keys (examples): `movies.manage`, `cinemas.manage`, `rooms.manage`, `showtimes.manage`, `prices.manage`, `bookings.view`, `bookings.cancel`, `payments.view`, `payments.verify`, `refunds.decide`, `tickets.validate`, `content.manage`, `promotions.manage`, `reports.view`, `staff.manage`, `roles.manage`, `settings.manage`, `audit.view`, `bank_accounts.manage`.
- Roles map to permission sets (seeded, editable by super admin only). A user may hold several roles.
- Cinema-scoped permissions (rooms, showtimes, bookings, reports, tickets, payments if assigned) are checked against `staff_cinema_assignments`; super admin bypasses scope via an explicit policy `before()` and is audited.
- Default deny: any route without an explicit policy/permission middleware fails a CI test that enumerates routes.
- The frontend receives the permission list for UX only.

## 5. Transport and browser controls

HTTPS only, HSTS in production; `SecurityHeaders` middleware on API (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Cache-Control: no-store` on private responses); Next.js sets CSP (nonce-based where feasible), frame-ancestors none, restrictive `Permissions-Policy` (camera allowed only on the scanner page, requested on user action).

## 6. Data protection

Passwords hashed (Laravel hasher); MFA secret and bank account number encrypted via Laravel `encrypted` cast; DB least-privilege user, port not public; encrypted backups; PII minimisation in reports and logs; documented retention in `DATABASE_SCHEMA.md`.

## 7. Required tests (to be written)

Unauthenticated admin access; customer reading another's booking/ticket/payment; cinema-manager cross-cinema; checker scope; unauthorized and duplicate payment verification; verifier self-approval; repeated booking request (idempotency); concurrent same-seat booking on MySQL; tampered price/seat IDs; invalid upload types; invalid QR; duplicate check-in under concurrency; invalid state transitions; mass assignment; CSRF/session expiry behaviour; privilege escalation; last-super-admin protection.

## 8. Known gaps / residual risks (as of Phase 1)

- Bank-transfer proof is human-verified; fraud risk remains and depends on verifier diligence. No automated bank reconciliation.
- Malware scanning is not built in; requires infrastructure (e.g. ClamAV) in production.
- Same-site cookie model requires sibling domains; a cross-site deployment needs a new approved design.
- MFA recovery and account recovery for staff need an operational procedure.
- WAF, DDoS protection, backup encryption, and monitoring/alerting are infrastructure responsibilities documented later in `DEPLOYMENT.md`.
- Environment currently lacks Composer and MySQL; no code or tests exist yet for any control above.

## 9. First-admin provisioning (planned)

`php artisan cineora:create-super-admin` prompts interactively for email and password (hidden input) or generates a one-time setup link; never seeded with a fixed password; requires MFA enrolment on first login in production.

## 10. Implementation status (updated Phase 4)

Implemented and covered by automated tests (MySQL, `php artisan test`) unless noted:

- Cookie-session auth with CSRF; session id regenerated on login, MFA confirm/challenge and password change; sessions invalidated on logout, password reset and password change (other devices).
- Login: per email+IP and per IP throttling; one generic failure for unknown email / wrong password / inactive account / wrong portal.
- Registration and password reset are enumeration-resistant (identical responses); email verification uses signed, expiring links keyed by public id and only ever redirects to the configured frontend.
- Staff TOTP MFA (pragmarx/google2fa): encrypted secret, hashed single-use recovery codes, replay protection of used time-steps, password re-authentication for setup, `mfa` middleware for admin routes, production policy `REQUIRE_STAFF_MFA`.
- Mass assignment: `User::$fillable` excludes `is_active`, MFA fields, verification and roles; registration ignores injected role fields (tested).
- Audit log with secret scrubbing for all auth events.
- Frontend: tokens never in JS-readable storage; only the non-secret XSRF cookie is read; `next` redirects restricted to same-site relative paths (unit tested).

Verified manually against a running server with curl: CSRF enforced (419 without token), HttpOnly session cookie, SameSite=Lax, CORS limited to the configured origin, signed verification link redirect, logout invalidation.

Not yet verified / known gaps:

- Secure-cookie, HSTS and `__Host-` cookie behaviour need an HTTPS deployment to verify.
- No browser-level (Playwright) test of the login UI exists yet; frontend coverage is the API client and redirect helper only.
- Session list/revoke relies on the `database` session driver; it is covered only for the guarded paths, not end-to-end.
- Account lockout is rate-limit based (no permanent lockout); `uncompromised()` password check is enabled only in production (needs network).
- Email delivery uses the `log` mailer in development; the transactional outbox arrives with the notification phase.

## 11. Implementation status (updated Phase 7)

Implemented and tested:

- **No double booking:** row locks in fixed order plus a unique index on live allocations. Verified with 8 genuinely parallel PHP processes against MySQL (same seat; overlapping seat pairs in both orders; same idempotency key; the per-customer unpaid limit). A test hook widens the race window so the tests do not pass by luck. With the application-level locks removed, the database constraint alone still prevented double allocation and the loser got a clean `seats_unavailable`.
- **No client-controlled money:** the booking request has no price, total, status or owner fields; totals come from the locked inventory rows; promo discounts are computed server-side in whole won and capped at the subtotal. Booking mass-assignment no longer includes `status` or the confirmed/cancelled timestamps (tests).
- **Idempotency:** required `Idempotency-Key`; replays return the original booking; a key reused with different content is `422`; failed attempts do not burn the key; keys are per customer.
- **State machine:** a single service re-reads the booking under a lock, validates against the transition map, writes append-only history and an audit entry, and rolls back with its side effects.
- **IDOR:** customers can only reach their own bookings (`404` otherwise), including staff accounts via the customer endpoints.
- **Expiry safety:** the maintenance job never touches bookings in review, exception, confirmed or refund states.

Known gaps:

- Seat holds, countdowns and expiry are verified, but payment submission/verification, tickets and QR validation do not exist yet (Phases 8 and 9). A booking cannot become `CONFIRMED` through any endpoint.
- Cancelling a showtime with live bookings, and cancelling paid bookings, need the refund workflow.
- The scheduler needs a cron entry in production; if it stops, holds still stop protecting seats (an expired hold is treated as free when someone books) but stale bookings stay listed until the job runs.
- No per-IP abuse control beyond rate limits (e.g. one customer holding many seats across many accounts).
- E2E coverage is the booking journey only (4 Playwright tests in Chrome); admin flows have no browser tests yet.

## 12. Implementation status (updated Phases 8 and 9)

Implemented and tested (backend 208 tests on MySQL, 9 browser journeys):

- **Payment proofs:** private disk, random names, no public URL, no path in any response. Images are decoded and re-encoded; PDFs are rejected if they contain `/JavaScript`, `/JS`, `/OpenAction`, `/Launch`, `/EmbeddedFile`, `/AA` and similar markers. PHP, HTML, SVG, EXE and zip content disguised as images or PDFs, oversize, empty and appended-payload files are tested. A file already used for another booking is refused; a rejected upload leaves no orphan file.
- **Access to proofs:** the owner, or staff with `payments.view` for that cinema; every staff view is audited. Customers, other cinemas' verifiers, checkers, cinema managers and anonymous users are refused (tested).
- **Review rules:** customers never verify; a verifier cannot approve their own booking or a proof they submitted; only the right cinema's verifiers decide; double verification and verifying a rejected payment are `409`; amount mismatches and lost seats cannot be verified; verification after the deadline becomes an exception instead of an approval; only administrators resolve exceptions.
- **Tickets:** issued only from a `CONFIRMED` booking, which only the verification service can produce; 256-bit random tokens; SHA-256 for lookup; raw token encrypted at rest and returned only to the owner; the QR carries a prefix and the token, nothing personal. Door responses contain no customer or payment data; unknown tokens and other cinemas' tickets are indistinguishable.
- **Atomic check-in:** conditional update under a row lock; six parallel scanners admit exactly one. A mutation test that removed the lock and the status condition did not fail, because MySQL reports "changed rows" and a repeated identical update reports zero, so that particular mutation was not a valid proof. The behaviour is covered by the parallel test and by reasoning about the conditional update, not by a killed mutant.
- **Outbox:** written in the same transaction as the decision; retries with backoff; failure does not affect payment or booking state.

Known gaps and risks:

- **PDF screening is a deny-list, not sanitisation.** Hex-obfuscated PDF names can evade string matching. PDFs are served as attachments with a sandbox CSP and are never rendered inline, but production should add malware scanning (for example ClamAV) on upload; images are safe because they are re-encoded.
- Proof storage is the local private disk. Back it up with the database and plan retention (`DATABASE_SCHEMA.md`); there is no automatic deletion yet.
- The QR token is retrievable by the application (encrypted with the app key) so the owner's QR can be redrawn. Rotating `APP_KEY` without re-encrypting would orphan existing QR codes; hashes still validate scanned tickets.
- Camera scanning (jsQR) is covered by no automated test; manual entry and the API are. Offline validation is intentionally not implemented.
- Refunds are whole-booking only. Verifier fatigue and social engineering of staff remain human risks: the system shows amount, date, sender name and the receipt but cannot confirm that money arrived in the bank account.

## 13. Implementation status (updated Phases 10 and 5b)

Done and tested (backend 247 tests, browser journeys in `e2e/`):

- **Role escalation blocked:** granting a permission you lack, assigning super admin as a non-super-admin, and editing your own roles are refused by `UserPolicy` and `StaffService`. Built-in roles are immutable.
- **Cinema scoping:** every admin list and detail query is limited to the staff member's assigned cinemas; another cinema's record is refused, covered by feature tests.
- **CSV export:** values beginning with `=`, `+`, `-`, `@`, tab or CR are prefixed so spreadsheets do not run them as formulas. Exports need `reports.export` and are audited.
- **Content is plain text:** events, articles, contact messages and testimonials have markup stripped on write and are rendered as text on the site (React escapes it). Verified in the browser with script and onerror payloads.
- **Public forms:** contact and newsletter have a honeypot and a per-client rate limit; newsletter responses do not reveal whether an address is already subscribed.
- **Settings:** allow-list of keys, unknown keys rejected, social links https only.
- **Audit log:** append-only, viewer only, no secret values.

Known gaps and residual risks:

- The 60-second cache of public API data on the Next.js side means edited or unpublished content may stay visible for up to a minute.
- The PDF check for payment proofs is a deny-list of active-content markers, not a sandboxed scan.
- Legal pages (terms, privacy) ship with default text that needs a lawyer's review before launch.
- Camera QR scanning has not been exercised in a real browser; manual entry has.
- Dark/light theme and phone widths of the admin screens have not been checked in a browser.
- MySQL on the development machine runs as root without a password; production must use a dedicated least-privilege user.
- Mutation checks: removing the booking row locks still passes because the unique allocation index prevents double sale on its own (kept deliberately as a second layer); the ticket check-in mutation was inconclusive because MySQL reports changed rows rather than matched rows.
