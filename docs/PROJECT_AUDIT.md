# Project Audit — AR Entertainment

Phase 1 deliverable. Based on inspection of the repository at commit `fda4b8e` (branch `master`). Nothing in this document has been implemented yet; "required" items are plans.

## 1. Existing application architecture

- Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript 5, Tailwind CSS 4, react-hook-form 7 + Zod 4, framer-motion, lucide-react.
- Frontend lives at the repository root (`src/`). No backend, no API calls, no `fetch`, no server actions, no route handlers, no `proxy.ts`, no tests, no `.env*` files.
- All pages are statically driven by TypeScript modules in `src/data/`. The only runtime persistence is `sessionStorage` (booking draft + "demo booking") and `localStorage` (theme).
- Theme: class-based light/dark with a pre-hydration script (`src/providers/theme-script.tsx`), tokens in `src/app/globals.css`.
- Per `AGENTS.md`, this Next.js version has breaking changes. Relevant verified facts from `node_modules/next/dist/docs/`: middleware is now `proxy.ts`; proxy must not be the sole authorization layer. Consult the docs before using any Next API in later phases.

## 2. Environment findings (blockers for Phase 2)

| Tool | Status |
|---|---|
| PHP | 8.5.0 CLI (ZTS, Windows). Laravel compatibility with 8.5 must be checked against the Laravel release chosen. |
| Composer | **Not found on PATH.** Needed to create the Laravel app. |
| MySQL | **Not found on PATH.** Needed for migrations and for concurrency tests (SQLite is not acceptable for those). |
| Node/npm | Present (project installs). |

Phase 2 cannot be verified until Composer and a MySQL 8 instance exist. No tests have been run in this phase; none are claimed.

## 3. Existing routes

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Hero, now-playing, top movies, featured banner, trailer strip, testimonials, partners, intro |
| `/movies` | `app/movies/page.tsx` | `MoviesExplorer` — client-side search/filter over static data |
| `/movies/[slug]` | `app/movies/[slug]/page.tsx` | Detail + `ShowtimeBrowser` |
| `/booking/[showtimeId]` | `app/booking/[showtimeId]/page.tsx` | Seat selection |
| `/booking/checkout` | `app/booking/checkout/page.tsx` | Customer form, demo bank details, proof preview |
| `/booking/confirmation` | `app/booking/confirmation/page.tsx` | Demo ticket with decorative QR |
| `/about`, `/contact`, `/privacy`, `/terms` | static | Contact + newsletter forms are not wired |
| `error.tsx`, `not-found.tsx` | | |

**Missing versus the brief:** no cinema list/detail pages, no events or news pages (an `Article` type exists but is unused), no account/login/registration, no "my bookings"/"my tickets", no admin area at all.

## 4. Existing components

- `booking/`: `seat-selector` (seat map, selection, 8-seat cap), `seat-picker`, `checkout` (RHF+Zod form, 5 MB file check client-side only), `confirmation`, `booking-context` (price/fee computation), plus `booking-context.tsx` hook `useBookingDetails`.
- `home/`: hero, now-playing, top-movies, featured-banner, trailer-strip, testimonials-section, partners, intro.
- `layout/`: header, footer, mobile-nav, search-overlay, theme-toggle, contact-form, newsletter-form, logo.
- `movies/`: movie-card, movies-explorer, showtime-browser, trailer-modal.
- `ui/`: art (generated gradient/motif artwork), button, misc (DemoNotice, Skeleton, BackLink), modal, reveal, section-heading.

## 5. Mock data inventory

| Source | Content | Replaced by |
|---|---|---|
| `src/data/movies.ts` (385 lines) | Movies, cast, director/writers, genres, rating, certificate, status, trailer, art spec | `movies`, `genres`, `movie_cast`, `movie_crew`, `movie_images`, `movie_trailers` |
| `src/data/cinemas.ts` | One cinema, one screen defined as `rows × seatsPerRow` + `priceMultiplier` | `cinemas`, `screening_rooms`, `seats`, `cinema_facilities` |
| `src/data/showtimes.ts` | Generated schedule: 7 days × 5 slots, rotating titles, IDs like `cineora_slug_0_1030` | `showtimes`, `showtime_seat_prices` |
| `src/data/testimonials.ts` | Static testimonials | `testimonials` |
| `src/lib/seats.ts` | `buildSeats` — seat grid, category by row, `BASE_PRICES`, **random unavailability via seeded PRNG** | `seats` + server-side availability endpoint |
| `src/lib/booking-store.ts` | sessionStorage draft/booking, client-generated reference (`Math.random`), `confirmDemoBooking` | `bookings` API |
| `src/config/site.ts` | Site name/contact, fictional bank details, socials, nav, `bookingTtlMs` (30 min), `maxSeatsPerBooking` | `site_settings`, `bank_accounts`, `social_links` |
| `components/booking/booking-context.tsx` | `SERVICE_FEE_PER_SEAT = 1`, subtotal/fee/total computed on the client | Server-calculated totals |
| `components/booking/confirmation.tsx` | `QrPlaceholder` (decorative, not scannable) | Real QR from server-issued ticket token |
| Art specs (`types/art.ts`) | Gradient + motif + local image paths under `public/images/` | `movie_images`, `cinema_images` uploads (art fallback may stay for missing images) |

## 6. Existing booking and seat-selection logic (assessment)

Verified from source; not assumed to be correct.

1. **Availability is fake.** `unavailable` is `rand() < 0.22` seeded from the showtime id. Nothing is ever reserved, so two users see identical "taken" seats and could both pick the same free seat.
2. **Prices are computed client-side** (`BASE_PRICES × priceMultiplier`, plus fee). Must move server-side; the client displays only.
3. **Hold timer** is the sessionStorage draft `createdAt` vs `bookingTtlMs` (30 min). Brief specifies hold 15 min and payment deadline 30 min; server must own both.
4. **Booking reference** generated with `Math.random` on the client — predictable and non-unique.
5. **Proof upload** never leaves the browser; only filename kept. Size check only (5 MB), no type check.
6. **Customer details** (name/email/phone) are free-form with no account. Brief requires authenticated customers; checkout must require login.
7. **Seat IDs** are `A1`-style, unique only within a room. Backend must key on room-scoped seat rows, not the string alone.
8. **Single cinema, single hall** is hard-coded in `showtimes.ts` (`cinemas[0]`, `screens[0]`). Multi-cinema requires cinema selection UI that does not exist today.
9. The `DemoNotice` banners and privacy/terms copy state "frontend demonstration"; these must be updated when real flows go live.

## 7. Identified technical problems / risks

- No automated tests of any kind; no test runner configured.
- `.gitignore` contains `.env*`, which would also ignore `.env.example`. Add `!.env.example`.
- Search overlay and explorer filter entirely client-side over the full dataset — fine for mocks, must become server-side with pagination.
- Date logic is relative (`dayOffset`, `releaseOffsetDays`, `use-today`) rather than absolute timestamps; backend uses UTC datetimes and the cinema's timezone for display.
- Currency is hard-coded USD; brief mentions bank transfer, so currency/locale must be configurable per deployment (decision needed).
- Contact and newsletter forms have no submission target.
- `graft/` and `tsconfig.tsbuildinfo` are tooling artefacts at repo root; `tsbuildinfo` is already ignored.

## 8. Required backend entities

All domains A–K in the brief, concretely defined in `DATABASE_SCHEMA.md`. Summary: access control (users, roles, permissions, staff cinema assignments), cinemas/rooms/seats, movies and metadata, showtimes + per-seat-category prices, bookings/booking seats/holds/status history, bank accounts/payments/proofs/reviews/refunds, tickets/check-ins, promotions, content (events, articles, testimonials), site settings/contact/newsletter, audit/notifications/outbox, idempotency keys.

## 9. Required API endpoints (summary; detail in future `API_DOCUMENTATION.md`)

- **Auth:** CSRF cookie, register, login, staff login, logout, forgot/reset password, verify email, change password, me, profile, MFA enrol/confirm/challenge.
- **Public:** movies (list/detail), genres, cinemas (list/detail), showtimes (filter by movie/cinema/date), seat availability per showtime, events, articles, site content, bank-transfer instructions (post-booking only), contact, newsletter.
- **Customer:** create booking (Idempotency-Key), list/detail own bookings, submit payment proof, payment status, tickets, refund request.
- **Admin:** dashboard, CRUD for movies/cinemas/rooms/seats/showtimes/promotions/events/articles/testimonials/bank accounts/settings, bookings, payment queue + verify/reject, exception resolution, refunds, ticket validate/lookup, customers, staff/roles/permissions, reports, audit logs.

## 10. Security requirements (summary; detail in `SECURITY.md`)

Cookie-based Sanctum SPA auth, CSRF, rate limits, policy+permission+cinema-scope authorization, server-side pricing, transactional seat locking with DB unique-constraint backstop, idempotent booking, append-only payment reviews, hashed random QR tokens with atomic check-in, private payment proofs, audit logging, security headers/CSP, MFA for privileged staff.

## 11. Proposed implementation architecture

- **Repository layout (decision):** keep the Next.js app where it is (repo root) to avoid a disruptive move of working code; add `backend/` (Laravel) and `docs/` as siblings. A later optional move to `frontend/` is mechanical and can be done separately. See `ARCHITECTURE.md`.
- **Auth topology:** Sanctum SPA cookies require same-site. Dev: `localhost:3000` + `localhost:8000` (same site). Production: `www.example.com` + `api.example.com`. Next.js will call the API **directly from the browser** with credentials for mutations; server components fetching public data call the API server-side without cookies; authenticated pages are client-fetched (or forward the cookie explicitly). This avoids a BFF proxy and its CSRF complications. Documented fully in `ARCHITECTURE.md`.
- **Admin panel:** inside the Next app under `/admin`, using the same API; proxy.ts performs only an optimistic redirect on a non-secret "session present" signal; the API is authoritative.

## 12. Phase plan

| Phase | Output | Needs |
|---|---|---|
| 1 | These four docs (done) | — |
| 2 | Laravel scaffold, Sanctum, MySQL, health endpoint, exception handler | Composer, MySQL 8 |
| 3 | Migrations, models, enums, roles/permissions, policies, factories, seeders, CLI first-admin command | MySQL |
| 4 | Auth endpoints + MFA + frontend login/register/account | |
| 5 | Movies/cinemas/rooms/seats/content CRUD + uploads; swap frontend mocks for these | |
| 6 | Showtimes + pricing + conflict validation + availability endpoint | |
| 7 | Holds, booking engine, idempotency, state machine, expiry jobs; rewire seat selector/checkout | MySQL concurrency tests |
| 8 | Bank accounts, proofs, verification queue, exceptions, notifications | |
| 9 | Tickets, QR, scanner UI, atomic check-in | |
| 10 | Remaining admin modules, reports, audit log UI | |
| 11 | Remove all remaining mock data, a11y/theme/mobile pass, Playwright E2E | |
| 12 | Security review, static analysis, dependency audit, deployment docs | |

Each phase ends with a written report of what was tested and what was not.

## 13. Open decisions for the owner

1. Repo layout: keep frontend at root + `backend/` (recommended) vs. move to `frontend/`.
2. **Decided:** currency KRW (₩, no minor units), timezone Asia/Seoul, locale ko-KR with en fallback.
3. **Decided:** service fee is optional, a server-side setting (`booking.service_fee_per_seat`), default 0.
4. **Decided:** frontend and API on sibling subdomains of one parent domain (exact domains TBD).
5. **Decided:** no Docker. Composer and MySQL 8 installed natively on Windows.

## 14. Progress log

| Phase | Status |
|---|---|
| 1 Audit and design docs | Done |
| 2 Laravel foundation | Done (health, envelope, headers, CORS, Sanctum) |
| 3 Schema, models, RBAC, policies, first-admin command | Done, 34 tests at the time |
| 4 Authentication (customer + staff + MFA) and frontend auth pages | Done |
| 5a Catalogue: movies, cinemas, rooms, seat layouts, secure uploads, frontend wired | Done (see below) |
| 5b Events, news, site content, testimonials | Not started (deferred) |
| 6 Showtimes, pricing, availability + frontend schedule and seat map on live data | Done |
| 7 Booking and seat-inventory engine, state machine, expiry job, real checkout and booking pages, Playwright E2E | Done |
| 8 Bank-transfer payments: accounts, secure proofs, verification queue, exceptions, refunds, outbox emails | Done |
| 9 Tickets and QR: issuance, owner display, atomic check-in, scanner, manual lookup | Done |

### Mock data still in use after Phase 5a

Replaced by the API: movie lists, movie detail, home page movie sections, movie search (explorer and overlay), genres.

Still mock (scheduled for later phases): `data/showtimes.ts` and the showtime browser (Phase 6); seat availability, prices, booking, checkout and confirmation (`lib/seats.ts`, `lib/booking-store.ts`, `data/movies.ts` and `data/cinemas.ts` lookups used by the booking flow; Phases 6 to 9); testimonials (Phase 5b); the homepage "Top Movies" showtime chip reads mock showtimes; site config such as bank details and contact info (Phases 5b and 8). `src/data/movies.ts` and `src/data/cinemas.ts` therefore remain in the repo until the booking flow no longer imports them.

### After Phase 6

Removed from the frontend: `data/movies.ts`, `data/cinemas.ts`, `data/showtimes.ts`, `types/cinema.ts`, `lib/use-today.ts`, `scripts/export-catalog.mjs` and the generated seat availability in `lib/seats.ts`. Showtimes, seat maps, seat prices and fees now come from the API (movie page, `/booking/[showtimeId]`, checkout and confirmation display, home page "next showtime").

Still demonstration-only: creating the booking itself (`lib/booking-store.ts`, the "confirm" button, the decorative QR) and testimonials/site settings. Those are Phases 7 to 9 and 5b.

### After Phase 7

Removed: the demo booking flow (`confirmDemoBooking`, `DemoBooking`, client-generated references, the decorative "ticket" page `/booking/confirmation`). Added: `/account/bookings` and `/account/bookings/[id]`, and a Playwright suite (`npm run e2e`) that starts its own API on port 8010 with the `cineora_e2e` database and the site on port 3110.

Still not real: bank-transfer details and proof upload (Phase 8), tickets and QR (Phase 9), the admin panel (Phase 10), testimonials and site settings (Phase 5b).

### After Phases 8 and 9

New customer pages: payment panel (bank details, proof upload) and ticket cards with QR on the booking page, plus `/account/tickets`. New staff area `/admin` (gated, role-aware navigation): Payments (queue, proof preview, verify, reject, exception, resolve), Refunds, Bank accounts, Scan tickets (camera after the checker presses Start, plus manual entry). The Phase 10 admin work (movies, cinemas, showtimes, reports, staff, audit-log viewer) builds on this shell.

Browser tests: `npm run e2e` runs 9 journeys (booking, double-seat protection, IDOR, pay by transfer, staff verification with the protected receipt, ticket issuance, door check-in and repeat-scan rejection, customer blocked from staff APIs).

### After Phases 10 and 5b

Done: the complete admin panel (dashboard, movies, cinemas and rooms, showtimes with prices, bookings, customers, payments queue, refunds, bank accounts, ticket scanner, promotions, events/news/testimonials, reports with CSV, staff and roles, audit log, website settings) and the public events, news, contact and newsletter pages, all backed by the API.

Verification: backend 247 tests pass; 25 frontend unit tests pass; 15 browser journeys pass (booking, payment and tickets, admin); type-check clean; lint has one unused-import warning; production build succeeds.

Remaining: Phase 11 (loading and empty-state polish, theme and mobile pass, wider browser coverage) and Phase 12 (security review, dependency audit, `DEPLOYMENT.md`, backup and restore).
