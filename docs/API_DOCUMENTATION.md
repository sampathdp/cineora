# API Documentation

Base URL: `{API_BASE_URL}/api/v1`. JSON only. This document is extended each phase; only endpoints that exist and are tested are listed.

## Conventions

- Success: `{ "success": true, "message": "...", "data": ..., "meta": {} }`
- Validation (422): `{ "success": false, "message": "The submitted information is invalid.", "code": "validation_failed", "errors": { "field": ["..."] } }`
- Other errors: `{ "success": false, "message": "...", "code": "..." }` with 401 `unauthenticated`, 403 `forbidden` / `mfa_required` / `mfa_setup_required`, 404 `not_found`, 419 `csrf_mismatch`, 429 `http_429`, 5xx `server_error` (no internal detail; correlate via the `X-Request-Id` response header).
- Public identifiers are ULIDs (`id`), never numeric database ids.
- Every response carries `X-Request-Id`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store, private`.

## Authentication model

Cookie-based Laravel Sanctum SPA mode. The browser must:

1. `GET {API_BASE_URL}/sanctum/csrf-cookie` (sets `XSRF-TOKEN` and the HttpOnly `laravel-session` cookie).
2. Send `credentials: include` and `X-XSRF-TOKEN: <decoded XSRF-TOKEN cookie>` on every `POST/PUT/PATCH/DELETE`.
3. Call from an allow-listed origin (`FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`); other origins get no CORS headers and no session.

Missing/invalid CSRF token → `419`. The frontend client (`src/lib/api/client.ts`) does this automatically and retries a 419 once.

## Rate limits (per minute unless noted)

| Limiter | Limit | Key |
|---|---|---|
| login / staff login | 5 + 30 per IP | email + IP |
| register | 10/hour per IP, 3/hour per email | IP, email |
| forgot/reset password | 5/hour per email+IP, 20/hour per IP | |
| MFA endpoints | 5 | user |
| email resend / verify | 3 | user |
| account endpoints, password change | 30 | user |
| health | 60 | IP |

## Endpoints

### `GET /health`
No auth. `200 { data: { status: "ok" } }`, `503` if the database is unreachable.

### Auth

| Method & path | Auth | Body | Result |
|---|---|---|---|
| `POST /auth/register` | none | `name, email, password, password_confirmation, terms, phone?` | `202` identical response whether or not the email already exists. New: verification email. Existing: "account exists" email. Always creates `customer` role only; role/is_active/verified fields in the body are ignored. |
| `POST /auth/login` | none | `email, password` | `200 { user, mfa_required, mfa_setup_required }`; failure is always `422 errors.email = "These credentials do not match our records."` (unknown email, wrong password, inactive account are indistinguishable). Regenerates the session. |
| `POST /auth/staff/login` | none | same | Same, but only accounts with a staff role succeed. |
| `POST /auth/logout` | session | – | Invalidates the session and CSRF token. |
| `GET /auth/me` | session | – | Current user: id, name, email, email_verified, is_staff, roles, permissions (UX hint only), cinemas, mfa `{enabled, required, verified}`. |
| `POST /auth/forgot-password` | none | `email` | `200` always the same message. Link goes to `FRONTEND_URL/reset-password?token&email`. |
| `POST /auth/reset-password` | none | `token, email, password, password_confirmation` | `200`; invalid/expired token → `422 errors.email`. Deletes all sessions of the account. |
| `GET /auth/email/verify/{userId}/{hash}` | signed URL (60 min) | – | `302` to `FRONTEND_URL/verify-email?status=success|invalid`. Never redirects to a request-supplied URL. |
| `POST /auth/email/resend` | session | – | `200` generic. |
| `POST /auth/password/change` | session | `current_password, password, password_confirmation` | `200`; new password must differ; other sessions are deleted; current session id regenerated. |

### MFA (staff only; non-staff get `403`)

| Method & path | Body | Notes |
|---|---|---|
| `POST /auth/mfa/setup` | `password` | Re-authenticates, generates a TOTP secret (stored encrypted) → `{ secret, otpauth_uri }`. `409` if already enabled. |
| `POST /auth/mfa/confirm` | `code` (6 digits) | Enables MFA, returns 8 one-time `recovery_codes` (stored only as SHA-256 hashes), regenerates the session and marks it MFA-verified. |
| `POST /auth/mfa/challenge` | `code` or `recovery_code` | Per-session step-up after login. Regenerates the session. A TOTP time-step cannot be reused. Recovery codes work once. |
| `DELETE /auth/mfa` | `password` | Blocked (`403 mfa_required_by_policy`) while `REQUIRE_STAFF_MFA` is on. |

Admin routes use the `staff` + `mfa` middleware: unauthenticated → 401; enrolled but not challenged this session → `403 mfa_required`; not enrolled while policy requires it → `403 mfa_setup_required`.

### Account (session)

| Method & path | Notes |
|---|---|
| `GET /account/profile` | user + phone, locale, marketing_opt_in |
| `PATCH /account/profile` | Only `name, phone, locale (en|ko), marketing_opt_in`. Email, roles and activation cannot be changed here. |
| `GET /account/sessions` | Own sessions; session ids are exposed only as opaque SHA-256 handles. |
| `DELETE /account/sessions/{handle}` | Ends another of your own sessions; `422` for the current one; `404` for anything not yours. |

## Audit events written so far

`auth.register`, `auth.register_duplicate`, `auth.login`, `auth.login_failed`, `auth.staff_login`, `auth.staff_login_failed`, `auth.logout`, `auth.email_verified`, `auth.password_reset`, `auth.password_changed`, `auth.mfa_enabled`, `auth.mfa_verified`, `auth.mfa_failed`, `auth.mfa_recovery_used`, `auth.mfa_disabled`, `account.profile_updated`, `account.session_revoked`. Passwords, tokens, codes and secrets are stripped from metadata; attempted emails are stored only as a truncated hash.

## Public catalogue (no auth, `throttle:public` 120/min per IP)

Only `published` movies and `active` cinemas/rooms are returned; drafts, archived and soft-deleted records are `404`. Responses contain no numeric ids, storage paths, status or timestamps.

| Endpoint | Query | Notes |
|---|---|---|
| `GET /movies` | `screening_status=now_playing|coming_soon`, `genre=<slug>`, `q` (title/tagline, wildcards escaped), `featured=1`, `sort=release_date|-release_date|title|-title|rating|-rating` (default `-release_date`), `per_page` (1–100, default 24), `page` | `meta: {page, per_page, total, last_page}`. Unknown sort values are `422` (no column injection). |
| `GET /movies/{slug}` | – | Adds languages. |
| `GET /genres` | – | `[{slug, name}]` |
| `GET /cinemas`, `GET /cinemas/{slug}` | – | Facilities, images, active rooms with `seat_count`. |

Movie fields: `id, slug, title, tagline, description, duration_min, release_date, age_rating, original_language, rating, screening_status, is_featured, poster_url, banner_url, trailer_url, art_theme, genres[], cast[], crew[], languages[], seo_*`. `art_theme` is the decorative gradient/motif the site design uses when no image exists.

## Admin catalogue (`auth` + `staff` + `mfa` + `throttle:admin` 240/min, then a policy per resource)

| Endpoint | Permission / scope |
|---|---|
| `GET /admin/movies` (`q,status,screening_status,per_page`), `GET /admin/movies/{id}` | `movies.view` |
| `POST /admin/movies`, `PATCH /admin/movies/{id}`, `DELETE /admin/movies/{id}` | `movies.manage`. New movies are always `draft`; `status`, `published_at`, `poster_path`, `banner_path` in the body are ignored. Slug is generated/unique. Delete is a soft delete and returns `409 has_showtimes` if any showtime exists. |
| `POST /admin/movies/{id}/publish|unpublish|archive` | `movies.publish`. Publishing requires a poster and a description (`422`). |
| `POST /admin/movies/{id}/images/{poster|banner}` (multipart `image`) | `movies.manage` |
| `GET /admin/cinemas`, `GET /admin/cinemas/{id}` | `cinemas.view` **and** assignment to that cinema (super admin: all) |
| `POST /admin/cinemas` | super admin with `cinemas.manage` |
| `PATCH /admin/cinemas/{id}` (slug immutable), `POST /admin/cinemas/{id}/images`, `DELETE /admin/cinemas/{id}/images/{imageId}` | `cinemas.manage` for that cinema |
| `GET/POST /admin/cinemas/{id}/rooms`, `PATCH/DELETE /admin/rooms/{id}` | `cinemas.view` / `rooms.manage` for the room's cinema. Room delete: `422` if it has showtimes. |
| `GET /admin/rooms/{id}/seats`, `PUT /admin/rooms/{id}/seats` | view / `rooms.manage`. `PUT` body `{seats:[{row_label,number,category_key,x?,y?}]}` (max 600). Response `{created,updated,removed,deactivated}`. Existing seats keep their id; seats with showtime inventory are deactivated rather than deleted and cannot change category; the whole replace is one transaction. |
| `GET /admin/seat-categories` | `cinemas.view` |

### Image uploads

Validated by sniffed content type (JPEG, PNG, WebP only; extension and client MIME ignored), decoded and re-encoded with GD (strips metadata and appended payloads), 100–5000 px per side, 5 MB, longest side downscaled to 2400 px, stored under a random ULID name in `movies/posters|banners` or `cinemas/{id}`. SVG, GIF, PDF and executables are rejected (`422` on field `image`). Replaced/removed images are deleted from storage.

Audit events added: `movie.created|updated|published|unpublished|archived|deleted|image_uploaded`, `cinema.created|updated|image_added|image_removed`, `room.created|updated|deleted|layout_updated`.

## Showtimes and seat availability (Phase 6)

Times are stored and returned in UTC (ISO 8601). Each showtime carries its cinema's `timezone` (default `Asia/Seoul`); clients render in that zone. Amounts are whole KRW.

### Public (`throttle:public`)

| Endpoint | Notes |
|---|---|
| `GET /showtimes` | Only `on_sale`, not started, active cinema, published movie. Query: `movie=<slug>`, `cinema=<slug>`, `date=YYYY-MM-DD` (the cinema's local calendar day), `per_page` (1-200). Default window: now to +14 days. Each row: `id, movie{slug,title,duration_min}, cinema{slug,name,timezone}, room{id,name,screen_type}, starts_at, film_ends_at, sales_closes_at, bookable, currency, prices[{category_key,category_name,price}], from_price, fee_per_seat, available_seats`. No internal status or numeric ids. |
| `GET /showtimes/{id}` | Same shape; `404` for draft, cancelled, started, unknown or inactive-cinema showtimes. |
| `GET /showtimes/{id}/seats` | Live seat map `[{key:"A1", row_label, number, category_key, category_name, price, status, x, y}]` with `status` of `available | held | sold | unavailable` and `bookable`. Computed from the database on every request, never cached (`Cache-Control: no-store`). A hold past its expiry is reported `available`. Does not reveal who holds or owns a seat. This is informational: booking creation re-checks under row locks. |

### Admin (`staff` + `mfa`; cinema scope from assignments)

| Endpoint | Permission |
|---|---|
| `GET /admin/showtimes` (`cinema,movie,status,from,to,per_page`), `GET /admin/showtimes/{id}` (adds `seat_counts`), `GET /admin/showtimes/{id}/seats` | `showtimes.manage` for that cinema |
| `POST /admin/showtimes` | `showtimes.manage` for the room's cinema. Body: `movie`, `room` (public ids), `starts_at` (ISO 8601 **with offset**), `sales_cutoff_minutes?` (0-240, default 15), `prices:[{category_key, price}]`. Creates a **draft** with price rows and one inventory row per active seat (price snapshot). |
| `PATCH /admin/showtimes/{id}` | `showtimes.manage`. Moving to another room also needs rights on the destination cinema and a matching `prices` list. |
| `PUT /admin/showtimes/{id}/prices` | `prices.manage` (separate from scheduling). Updates inventory snapshots; audited with before/after. |
| `POST /admin/showtimes/{id}/publish`, `POST /admin/showtimes/{id}/cancel` | `showtimes.manage` |

Validation and rules:

- `starts_at` must be in the future and within `SHOWTIME_MAX_DAYS_AHEAD` (180). The movie must not be archived (and must be published to go on sale); the room and cinema must be active and the room must have active seats.
- `ends_at = starts_at + movie duration + SHOWTIME_BUFFER_MINUTES` (20). Two non-cancelled showtimes in one room may not overlap (back-to-back is allowed). The check runs under a row lock on the room; a unique index on `(room, starts_at)` for non-cancelled showtimes is the final backstop. A cancelled showtime frees its slot.
- Prices must cover exactly the seat categories used by the room, as whole won between 0 and 1,000,000. Float, negative, duplicate and unknown-category prices are `422`.
- While any live booking exists for a showtime (pending payment, in review, rejected-but-held, exception, confirmed, refund states) its schedule, movie, room and prices cannot change and it cannot be cancelled: `409 has_active_bookings`. `sales_cutoff_minutes` can still be adjusted. Cancelling with bookings will be handled by the refund workflow in a later phase.
- Started, cancelled and completed showtimes are immutable (`409 invalid_state` / `already_started`).
- Inventory is a snapshot taken when the showtime is created (or its room changes): seats added to a room later do not appear in existing showtimes.

Audit events: `showtime.created|updated|published|cancelled|prices_changed`.

## Bookings (Phase 7)

Customer endpoints; session auth; every query is scoped to the signed-in user. Someone else's booking is a `404`, never a `403`, and numeric ids are not accepted.

| Endpoint | Notes |
|---|---|
| `POST /bookings` | Header `Idempotency-Key` (8-80 chars of `A-Za-z0-9_-`) is **required**. Body: `showtime` (public id), `seats` (labels like `A1`, 1-8), `promo_code?`. Anything else (prices, totals, status, user, cinema) is ignored. Requires a verified email (`403 email_unverified`). Rate limit 10/min. |
| `GET /bookings`, `GET /bookings/{id}` | Own bookings. `meta.server_now` lets the UI show a countdown against the server clock. |
| `POST /bookings/{id}/cancel` | Only while `PENDING_PAYMENT` or `PAYMENT_REJECTED`; releases seats and promo usage. Paid or reviewed bookings go through the refund workflow (later phase): `409 not_cancellable`. |

`POST /bookings` results: `201` created (header `Idempotent-Replayed: false`); `200` replay of the same key and payload (returns the original booking, `Idempotent-Replayed: true`); `409 seats_unavailable` with `errors.seats` listing the labels; `409 sales_closed`; `409 too_many_pending` (max 3 unpaid); `409 request_in_progress`; `422` for validation, unknown seats, invalid promo (`errors.promo_code`) or a key reused with a different payload; `404` for a showtime that is not on sale.

Booking object: `id, reference (CIN-XXXXXXXX), status, currency, subtotal, discount, fee, total, hold_expires_at, payment_deadline_at, created_at, confirmed_at, cancelled_at, seats[{label, category, unit_price}], showtime{...}`. Amounts are whole KRW calculated by the server from the locked inventory rows (price snapshot per seat) plus `BOOKING_SERVICE_FEE_PER_SEAT` minus any validated promo.

### Timing

`BOOKING_SEAT_HOLD_MINUTES` (15) is how long seats are held while the customer pays; `BOOKING_PAYMENT_DEADLINE_MINUTES` (30) is the outer limit used for review (Phase 8). Both are absolute UTC timestamps on the booking; they are never extended by refreshing or resubmitting. A scheduler task (`booking-maintenance`, every minute; add `* * * * * php artisan schedule:run` to cron) and the command `php artisan bookings:maintain` expire due bookings, close finished showtimes and prune idempotency keys older than 2 days. The job only expires unpaid bookings (`PENDING_PAYMENT` past the hold, `PAYMENT_REJECTED` past the deadline) and re-checks state under a row lock, so it is idempotent and can never release seats of a booking that is in review, in exception, confirmed or in a refund state.

### How double booking is prevented

1. One transaction (retried up to 3 times on deadlock).
2. The customer's user row is locked first: one customer cannot run two bookings at the same time (this also enforces the unpaid-booking limit).
3. The requested `showtime_seats` rows are locked `FOR UPDATE` in ascending id order; availability and prices are read from those locked rows.
4. A hold that has lapsed is treated as free and its stale allocation rows are retired; the previous booking's later cleanup only touches rows still assigned to it.
5. A unique index on live allocations (`booking_seats(showtime_seat_id, active_key)`) is an independent last line of defence; a violation is returned as `409 seats_unavailable`.

Audit events: `booking.created`, `booking.status_changed`.

## Payments, refunds and tickets (Phases 8 and 9)

### Customer (session auth, own bookings only; others are `404`)

| Endpoint | Notes |
|---|---|
| `GET /bookings/{id}/payment` | Bank details (active account for the cinema, else the global one), `transfer_memo` (= booking reference), `expected_amount`, status, `rejection_reason` (the reason a verifier gave, never internal notes), uploaded proofs (id, mime, size). Creates the payment row on first call. `409 payment_unavailable` if no bank account is configured. |
| `POST /bookings/{id}/payment/proof` | `multipart/form-data`: `proof` (JPEG/PNG/WebP/PDF, 5 MB), `submitted_amount` (whole KRW), `transfer_date` (`Y-m-d`, from the booking date to today), `payer_name?`. 5/min. Moves the booking to `PAYMENT_REVIEW` and keeps its seats protected **until the original payment deadline, never longer**. Refused with `409`: `hold_expired`, `deadline_passed`, `already_submitted`, `not_payable`, `seats_lost`, `showtime_closed`. `422` for bad files, an unreadable amount/date, or a file already used as proof for another booking. |
| `GET /bookings/{id}/payment/proofs/{proofId}` | The owner's own file, streamed from private storage (`nosniff`, `Cache-Control: no-store`, CSP `sandbox`; PDFs as attachment). |
| `GET /bookings/{id}/tickets`, `GET /tickets` | Own tickets. `qr` (the QR content, prefix `CINEORA1:` + 256-bit random token) is returned only to the owner and only for `valid`/`used` tickets. |
| `POST /bookings/{id}/refund-request` | `reason` (5-1000 chars). Only for `CONFIRMED` bookings until `REFUND_CUTOFF_HOURS` (2) before the show and only if no ticket was used. Voids the tickets while the request is open. |

### Staff

| Endpoint | Permission |
|---|---|
| `GET /admin/payments` (`queue=pending` or `exceptions`, `status`, `q`, `per_page`), `GET /admin/payments/{id}` | `payments.view`, limited to assigned cinemas. Customer name and email only with `bookings.view_customer`. |
| `GET /admin/payments/{id}/proofs/{proofId}` | `payments.view` for that cinema. Every access is audited (`payment.proof_viewed`). |
| `POST /admin/payments/{id}/verify` | `payments.verify`. Refused for the booking's own customer and for whoever submitted the proof (`403`). `409` codes: `invalid_state` (already handled, so the second reviewer loses), `amount_mismatch`, `seats_lost`, `showtime_closed`, `deadline_passed` (the payment is moved to the exception queue instead of being approved). On success: payment `VERIFIED`, booking `CONFIRMED`, seats `sold`, one ticket per seat. |
| `POST /admin/payments/{id}/reject` | `payments.verify`; `reason` is required (5-300 chars) and shown to the customer; `notes` stay internal. Seats stay protected for a resubmission until the payment deadline. |
| `POST /admin/payments/{id}/exception` | `payments.verify`; hands a problem proof to administrators. |
| `POST /admin/payments/{id}/resolve` | `bookings.resolve_exceptions` (administrators). `action=confirm` (only if the seats are still the booking's; a different amount needs `acknowledge_amount_difference`) or `action=cancel` (queues a refund for money received and releases the seats). `note` required. |
| `GET /admin/refunds`, `POST /admin/refunds/{id}/deny`, `POST /admin/refunds/{id}/pay` | `refunds.decide`. A refund of a cancelled exception booking cannot be denied. Paying records a transaction, marks tickets `refunded`, the booking `REFUNDED`, and returns the seats to sale. |
| `GET/POST /admin/bank-accounts`, `PATCH /admin/bank-accounts/{id}` | `payments.manage_bank_accounts`. Account numbers are encrypted at rest and never written to the audit log. |
| `POST /admin/tickets/validate` | `tickets.validate` for the ticket's cinema. Body `code` (scanned QR content) or `reference` (the printed ticket reference), optional `showtime`. Always HTTP 200 with `data.result` in `valid`, `already_used`, `cancelled`, `refunded`, `wrong_showtime`, `invalid`, `void`. Unknown tokens and tickets of other cinemas are both `invalid`. The ticket info returned is limited to seat, category, movie, start time, room and (if used) when. Check-in is open from `TICKET_CHECKIN_OPENS_MINUTES` (120) before the show until the film ends. 120/min. |
| `GET /admin/tickets/recent` | The caller's own last 25 attempts. |

### How the guarantees are met

- **Verification is atomic and once-only:** booking, then payment, are locked `FOR UPDATE` in that order; the state is re-checked under the lock, so a second reviewer gets `409`. Review rows are only ever inserted (no route or code path edits or deletes them).
- **Nothing is released or issued quietly at the deadline:** `booking-maintenance` moves bookings still in review at their payment deadline to `PAYMENT_EXCEPTION`, extending seat protection to the start of the show. A lapsed hold of a booking in review or exception is never treated as free by new bookings or by the public seat map.
- **Door check:** one conditional `UPDATE tickets SET status='used' ... WHERE status='valid'` under a row lock; zero affected rows means someone else got there first. Tested with six scanners in parallel processes against MySQL.
- **Emails** are written to `outbox_messages` in the same transaction as the decision and delivered by the scheduled worker with retry and backoff (max 5 attempts, then `failed`). A mail outage never changes a payment or booking.

Audit events added: `payment.proof_submitted`, `payment.proof_viewed`, `payment.verified`, `payment.rejected`, `payment.exception`, `payment.exception_resolved`, `payment.exception_cancelled`, `refund.requested`, `refund.denied`, `refund.paid`, `bank_account.created`, `bank_account.updated`, `ticket.checked_in`.

---

## Phase 10 and 5b: administration, reporting and site content

All `/admin/*` routes need a signed-in staff user (`staff` middleware), a passed MFA check when `REQUIRE_STAFF_MFA` is on (`mfa`), and the `admin` rate limit. Each controller then checks a policy or permission, scoped to the cinemas the staff member is assigned to (super admins see all). The UI hides what a role cannot use, but the server is what decides.

### Public content

| Endpoint | Notes |
|---|---|
| `GET /site` | Allow-listed public settings (contact details, social links, legal text, opening hours). Nothing private is ever returned. |
| `GET /events`, `GET /events/{slug}`, `GET /articles`, `GET /articles/{slug}`, `GET /article-categories`, `GET /testimonials` | Published items only. Scheduled items appear when their time arrives. Bodies are plain text. |
| `POST /contact`, `POST /newsletter` | Rate limited per client (`CONTACT_RATE_LIMIT`, per hour). The contact form has a hidden honeypot field; a filled honeypot is answered with success but stored nowhere. Newsletter sign-up never reveals whether an address was already subscribed. |

The Next.js site caches public API data for up to 60 seconds, so newly published content can take up to a minute to show.

### Reports and dashboard

| Endpoint | Permission |
|---|---|
| `GET /admin/dashboard` | `reports.view`. Totals for the staff member's cinemas. |
| `GET /admin/reports/{type}` | `reports.view`. Types: `bookings`, `revenue`, `cinemas`, `movies`, `payments`, `checkins`, `refunds`. Query: `from`, `to`, `group=day` or `month`. Aggregates only, no personal data. |
| `GET /admin/reports/{type}?format=csv` | `reports.export`. Formula injection is neutralised (cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with a quote). Exports are audited. |

### Bookings and customers

| Endpoint | Permission |
|---|---|
| `GET /admin/bookings`, `GET /admin/bookings/{id}` | `bookings.view`; customer name and email only with `bookings.view_customer`. |
| `POST /admin/bookings/{id}/cancel` | `bookings.cancel`; `reason` required; releases unsold seats. A paid booking is refunded through the refund queue, never silently. |
| `GET /admin/customers`, `GET /admin/customers/{id}` | `customers.view`. Contact details and booking history for the cinemas the staff member manages. |

### Promotions

`GET/POST /admin/promotions`, `PATCH/DELETE /admin/promotions/{id}` need `promotions.manage`. A code is validated again on the server at checkout; the discount is computed from server-side prices only.

### Staff, roles and permissions

| Endpoint | Rule |
|---|---|
| `GET /admin/staff`, `POST /admin/staff`, `PATCH /admin/staff/{id}` | `staff.manage`. A new staff member is emailed a set-password link, never a password. Cinema assignments limit what they can reach. |
| `POST /admin/staff/{id}/reset-mfa` | `staff.manage`; audited. |
| `GET /admin/roles`, `GET /admin/permissions`, `POST /admin/roles`, `PATCH/DELETE /admin/roles/{key}` | `roles.manage`. Built-in roles cannot be edited or deleted. **No escalation:** a caller cannot grant a permission they do not hold themselves, cannot assign the super admin role unless they are one, and cannot change their own roles. |

### Content management

| Endpoint | Permission |
|---|---|
| `GET/POST/PATCH /admin/events`, `GET/POST/PATCH /admin/articles` | `content.manage`. Titles and bodies are stored as plain text (markup stripped). Status cannot be set through create or update. |
| `POST /admin/content/{events or articles}/{id}/{action}` | `content.publish`. Actions: publish, unpublish, schedule (future `publish_at`, published by the minute worker), archive. |
| `POST /admin/content/{kind}/{id}/image`, `DELETE /admin/content/{kind}/{id}` | `content.manage`. Images go through the secure upload pipeline (re-encoded). |
| `GET/POST /admin/article-categories`, `GET/POST/PATCH/DELETE /admin/testimonials` | `content.manage`. |
| `GET /admin/messages`, `POST /admin/messages/{id}/handled`, `GET /admin/newsletter` | `messages.view`. Contact messages and subscriber addresses are personal data. |

### Settings

`GET /admin/settings`, `PUT /admin/settings`, `PUT /admin/settings/social-links`, `PUT /admin/settings/content/{key}` need `settings.manage`. Only keys on the allow-list are accepted; an unknown key is a validation error. Social links must be `https`.

### Audit log

`GET /admin/audit-logs` (`audit.view`): filters `action` (prefix), `actor`, `from`, `to`. Read-only; there is no write or delete route. Secrets, passwords, tokens and bank account numbers are never written to it.
