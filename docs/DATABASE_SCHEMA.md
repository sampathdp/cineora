# Database Schema

Status: design (Phase 1); migrations are written in Phase 3. MySQL 8.0+, InnoDB, `utf8mb4`, all timestamps UTC (`TIMESTAMP`/`DATETIME` in UTC; cinema timezone stored on `cinemas.timezone` for display). Money is `DECIMAL(12,2)` with an ISO currency column; initial currency is KRW, which has no minor units, so the application validates and rounds all KRW amounts to whole won (percentage discounts rounded down to whole won). Default cinema timezone `Asia/Seoul`. No floats for money.

Conventions: `id` BIGINT UNSIGNED internal PK; `public_id` CHAR(26) ULID unique for anything exposed via API; `created_at/updated_at`; `deleted_at` only where history must survive (movies, cinemas, rooms, users). Mass-assignment is controlled with explicit `$fillable`.

## ERD (core)

```mermaid
erDiagram
  users ||--o| customer_profiles : has
  users }o--o{ roles : user_roles
  roles }o--o{ permissions : role_permissions
  users ||--o{ staff_cinema_assignments : assigned
  cinemas ||--o{ staff_cinema_assignments : scope
  cinemas ||--o{ screening_rooms : has
  screening_rooms ||--o{ seats : has
  seat_categories ||--o{ seats : classifies
  movies }o--o{ genres : movie_genres
  movies ||--o{ showtimes : screened
  screening_rooms ||--o{ showtimes : hosts
  cinemas ||--o{ showtimes : at
  showtimes ||--o{ showtime_seat_prices : prices
  showtimes ||--o{ showtime_seats : inventory
  seats ||--o{ showtime_seats : instance
  users ||--o{ bookings : makes
  showtimes ||--o{ bookings : for
  bookings ||--o{ booking_seats : contains
  showtime_seats ||--o| booking_seats : allocated
  bookings ||--o{ seat_holds : holds
  bookings ||--o{ booking_status_histories : history
  bookings ||--o{ payments : paid_by
  bank_accounts ||--o{ payments : to
  payments ||--o{ payment_proofs : evidence
  payments ||--o{ payment_reviews : reviewed
  bookings ||--o{ refund_requests : refund
  refund_requests ||--o{ refund_transactions : paid
  booking_seats ||--|| tickets : issues
  tickets ||--o{ ticket_checkins : scanned
  tickets ||--o{ ticket_validation_events : attempts
  promo_codes ||--o{ promo_redemptions : used
  bookings ||--o| promo_redemptions : applies
```

## A. Users and access control

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `users` | id, public_id, name, email, email_verified_at, password (bcrypt/argon), is_active, mfa_secret (encrypted), mfa_confirmed_at, mfa_recovery_codes (encrypted, hashed), last_login_at | UNIQUE(email), UNIQUE(public_id), INDEX(is_active) |
| `customer_profiles` | user_id PK/FK, phone, date_of_birth?, marketing_opt_in, locale | FK users ON DELETE CASCADE |
| `roles` | id, key (`super_admin`,`cinema_manager`,`payment_verifier`,`ticket_checker`,`content_manager`,`customer`), name, is_system | UNIQUE(key) |
| `permissions` | id, key (e.g. `payments.verify`), group | UNIQUE(key) |
| `role_permissions` | role_id, permission_id | PK(role_id,permission_id), FKs CASCADE |
| `user_roles` | user_id, role_id, assigned_by | PK(user_id,role_id), FKs CASCADE (assigned_by SET NULL) |
| `staff_cinema_assignments` | user_id, cinema_id | PK(user_id,cinema_id); FK CASCADE. Cinema-scoped permissions apply only to assigned cinemas; super admin is global. |
| `password_reset_tokens` | email, token (hashed), created_at | Laravel standard |
| `sessions` | Laravel `database` session driver: id, user_id, ip, user_agent, payload, last_activity | INDEX(user_id), INDEX(last_activity). Serves as `user_sessions`; no separate table. |
| `personal_access_tokens` | **Not created** — cookie SPA auth does not need it (publish only if bearer mode is ever approved). |

Guard rails (enforced in services + tests): cannot remove/deactivate the last active super admin; cannot grant a role/permission you do not hold (no privilege escalation).

## B. Cinemas

| Table | Key columns | Constraints |
|---|---|---|
| `cinemas` | id, public_id, slug, name, area, address, phone, email, description, timezone, currency, is_active, deleted_at | UNIQUE(slug) |
| `cinema_facilities` | id, cinema_id, name | UNIQUE(cinema_id,name); FK CASCADE |
| `cinema_images` | id, cinema_id, path, alt, sort_order | FK CASCADE |
| `screening_rooms` | id, public_id, cinema_id, name, screen_type, is_active, deleted_at | UNIQUE(cinema_id,name); FK RESTRICT |
| `seat_categories` | id, cinema_id (nullable = global), key, name, default_price | UNIQUE(cinema_id,key) |
| `seats` | id, room_id, row_label, number, seat_category_id, x, y (layout), is_active | **UNIQUE(room_id,row_label,number)**; FK room RESTRICT. Layout edits that would remove a seat with any future `showtime_seats`/active booking are refused; seats are deactivated, not deleted. |

## C. Movies

| Table | Notes |
|---|---|
| `movies` | id, public_id, slug (UNIQUE), title, tagline, description, duration_min, release_date, age_rating, original_language, poster_path, banner_path, trailer_url, rating, status (`draft`,`published`,`archived`), screening_status (`now_playing`,`coming_soon`), is_featured, seo_title, seo_description, published_at, deleted_at. INDEX(status,screening_status,release_date) |
| `genres` | id, slug UNIQUE, name |
| `movie_genres` | movie_id, genre_id PK |
| `movie_cast` | id, movie_id, person_name, character_name, sort_order |
| `movie_crew` | id, movie_id, person_name, job (`director`,`writer`,…), sort_order |
| `movie_images` | id, movie_id, path, kind, alt, sort_order |
| `movie_trailers` | id, movie_id, url (allowlist YouTube/Vimeo hosts), title, sort_order |
| `movie_languages` | id, movie_id, language_code, kind (`audio`,`subtitle`) — UNIQUE(movie_id,language_code,kind) |

## D. Showtimes

| Table | Notes |
|---|---|
| `showtimes` | id, public_id, movie_id, cinema_id, room_id, starts_at, ends_at (= start + duration + buffer, computed server-side), status (`draft`,`on_sale`,`cancelled`,`completed`), sales_cutoff_minutes, created_by. **UNIQUE(room_id,starts_at)**; INDEX(movie_id,starts_at), INDEX(cinema_id,starts_at). Cinema/room consistency enforced by composite FK `(room_id,cinema_id)` → `screening_rooms(id,cinema_id)` (add UNIQUE(id,cinema_id) on rooms). Overlap check (`starts_at < other.ends_at AND ends_at > other.starts_at`) done under a room-level lock in the service (MySQL has no exclusion constraint). |
| `showtime_seat_prices` | showtime_id, seat_category_id, price DECIMAL(12,2). PK(showtime_id,seat_category_id). Category must belong to the showtime's cinema/global (service check). |
| `showtime_seats` | id, showtime_id, seat_id, price DECIMAL(12,2) snapshot, status (`available`,`held`,`sold`,`blocked`), booking_id NULL, hold_expires_at NULL. **UNIQUE(showtime_id,seat_id)**; INDEX(showtime_id,status). This is the lock target for bookings. Price edits are blocked once any booking exists for the showtime. |

## E. Bookings

| Table | Notes |
|---|---|
| `bookings` | id, public_id, reference (UNIQUE, random 8–10 chars unambiguous alphabet), user_id, showtime_id, cinema_id, movie_id, status (enum), subtotal, discount, fee, total, currency, promo_code_id NULL, hold_expires_at, payment_deadline_at, expires_at, confirmed_at, cancelled_at, created_at. INDEX(user_id,created_at), INDEX(status,payment_deadline_at), INDEX(showtime_id,status) |
| `booking_seats` | id, booking_id, showtime_id, showtime_seat_id, seat_id, seat_label, category_name, unit_price (**snapshot**). **UNIQUE(showtime_seat_id, active_key)** where `active_key` = generated column `IF(released_at IS NULL, 1, NULL)`; released rows keep history while active allocations remain unique. FK booking CASCADE |
| `seat_holds` | id, booking_id, showtime_seat_id, expires_at, released_at. Same active-unique pattern. |
| `booking_status_histories` | id, booking_id, from_status, to_status, actor_user_id NULL, reason, created_at — append-only |
| `booking_events` | id, booking_id, type, payload JSON (non-sensitive), created_at — append-only |
| `idempotency_keys` | id, user_id, key, request_hash, resource_type, resource_id, response_snapshot, created_at. UNIQUE(user_id,key) (added table; required for idempotency) |

## F. Payments

| Table | Notes |
|---|---|
| `bank_accounts` | id, public_id, cinema_id NULL (global), bank_name, account_name, account_number (encrypted), branch, swift, instructions, is_active |
| `payments` | id, public_id, booking_id, payment_reference (UNIQUE), bank_account_id, expected_amount, submitted_amount, transfer_date, payer_name, status (enum), submitted_by, submitted_at, verified_at, locked (bool). INDEX(status,submitted_at). One non-rejected payment per booking at a time (service rule + partial-style generated unique). |
| `payment_proofs` | id, payment_id, disk=private, path (random), original_name (display only), mime (sniffed), size, sha256, uploaded_by |
| `payment_reviews` | id, payment_id, reviewer_id, decision (`verified`,`rejected`,`exception`), reason (required when rejected), internal_notes, created_at — **append-only** (no UPDATE/DELETE granted in app code; model guards) |
| `refund_requests` | id, public_id, booking_id, requested_by, reason, amount, status (`pending`,`approved`,`denied`,`paid`), decided_by, decided_at |
| `refund_transactions` | id, refund_request_id, amount, reference, paid_at, recorded_by |

## G. Tickets

| Table | Notes |
|---|---|
| `tickets` | id, public_id (ULID, shown as reference), booking_id, booking_seat_id (UNIQUE — one ticket per seat), showtime_id, token_hash CHAR(64) UNIQUE (SHA-256 of random token), status (`valid`,`used`,`cancelled`,`refunded`,`void`), issued_at, used_at |
| `ticket_checkins` | id, ticket_id UNIQUE, checker_id, cinema_id, checked_in_at |
| `ticket_validation_events` | id, ticket_id NULL, checker_id, cinema_id, outcome (`valid`,`already_used`,`cancelled`,`refunded`,`wrong_showtime`,`invalid`,`void`), token_fingerprint (first 8 of hash only), created_at |

## H. Promotions

`promo_codes`: id, code UNIQUE (case-insensitive collation), type (`fixed`,`percent`), value, min_amount, max_discount, starts_at, ends_at, usage_limit, per_user_limit, is_active, restrictions via `promo_code_movies` / `promo_code_cinemas` pivots. `promo_redemptions`: promo_code_id, user_id, booking_id UNIQUE, amount, created_at; usage counted under lock on the promo row.

## I. Content

`events` (slug UNIQUE, title, body, image_path, starts_at, ends_at, cinema_id NULL, status, published_at, is_featured, seo_*), `articles` (slug UNIQUE, category_id, title, excerpt, body, author_id, image_path, status, scheduled_at, published_at, is_featured, seo_*), `article_categories` (slug UNIQUE, name), `testimonials` (name, title, quote, rating 1–5, is_published, sort_order). Body is sanitized on write (allowlist) and escaped on render.

## J. Site configuration

`site_settings` (key UNIQUE, value JSON, is_public), `site_content` (key UNIQUE, locale, body), `social_links` (platform, url, sort_order), `contact_messages` (name, email, subject, message, ip_hash, status), `newsletter_subscribers` (email UNIQUE, confirmed_at, unsubscribed_at, token_hash).

## K. Audit and notifications

`audit_logs` (id, actor_id NULL, action, resource_type, resource_id, metadata JSON (allowlisted, no secrets), ip, user_agent, correlation_id, created_at; INDEX(resource_type,resource_id), INDEX(actor_id,created_at), INDEX(action,created_at)); `notifications` (Laravel standard, polymorphic notifiable); `notification_attempts` (notification_id, channel, status, error_summary, attempted_at); `outbox_messages` (id, type, payload JSON, status `pending|sent|failed`, available_at, attempts, last_error, created_at; INDEX(status,available_at)).

## Cascade and retention

- Financial and ticket records (`bookings`, `payments`, `payment_reviews`, `tickets`, `audit_logs`) never cascade-delete from users/cinemas/movies: parents use soft deletes and FKs are `RESTRICT`.
- Child-of-aggregate tables (images, facilities, cast, pivots) cascade.
- Payment proofs: retain per local financial retention policy (assumed 7 years; confirm). Customer deletion = anonymise `users`/`customer_profiles`, keep booking rows.
- `audit_logs` retained ≥ 1 year; `ticket_validation_events` ≥ 90 days (configurable).

## Transaction boundaries

| Operation | Locks | Atomic unit |
|---|---|---|
| Create booking | `showtime_seats` rows (ordered), idempotency row | booking + seats + holds + history + outbox |
| Expire booking | booking row | status change + seat release + history |
| Submit proof | booking + payment rows | payment + proof metadata + booking→PAYMENT_REVIEW + history (file stored first, orphan cleanup on rollback) |
| Verify/reject payment | payment, booking, showtime_seats | review row + payment/booking status + tickets + history + audit + outbox |
| Check in ticket | ticket row | conditional update + check-in + validation event |
| Showtime create | room-level lock | overlap check + showtime + showtime_seats + prices |
| Redeem promo | promo row | counter check + redemption |
