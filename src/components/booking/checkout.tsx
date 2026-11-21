"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { bookingsApi } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { clearDraft, isExpired, useDraft } from "@/lib/booking-store";
import { formatISODate, formatPrice, formatTime } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { BackLink, Skeleton } from "@/components/ui/misc";
import { FormMessage, inputClass } from "@/components/auth/form-kit";
import { MissingBooking, useBookingDetails } from "./booking-context";
import { routes } from "@/lib/routes";

/**
 * Review step. Pressing "Reserve seats" asks the server to create the booking: the server re-checks availability,
 * calculates the total and holds the seats. Nothing shown here (prices, totals) is sent to the server.
 */
export function Checkout() {
  const router = useRouter();
  const draft = useDraft();
  const details = useBookingDetails(draft);
  const { status, user } = useAuth();
  const [promo, setPromo] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; seats?: string[]; field?: string } | null>(null);

  if (draft === undefined || status === "loading" || (draft !== null && details === undefined)) {
    return (
      <div className="container-page pt-32">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (draft === null || !details || details.seats.length === 0) {
    return <MissingBooking title="No booking in progress" message="Choose a movie, showtime and seats first. Your selection is only remembered in this browser tab." />;
  }
  if (isExpired(draft)) {
    return <MissingBooking title="Your selection expired" message="Seat selections are only remembered for 30 minutes. Please pick your seats again." />;
  }

  if (status === "anonymous" || !user) {
    return (
      <div className="container-page pb-20 pt-28 sm:pt-32">
        <BackLink href={routes.seats(details.showtime.id)}>Change seats</BackLink>
        <h1 className="display mt-2 text-4xl sm:text-6xl">Sign in to reserve</h1>
        <p className="mt-3 max-w-xl text-muted">
          Your {details.seats.length} selected seat{details.seats.length > 1 ? "s are" : " is"} remembered. Sign in or create an account to reserve{" "}
          {details.seats.length > 1 ? "them" : "it"}; seats are only held once you do.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login?next=/booking/checkout" className="inline-flex min-h-12 items-center rounded-control bg-accent px-7 font-semibold text-on-accent hover:bg-accent-hover">
            Sign in
          </Link>
          <Link href="/register" className="inline-flex min-h-12 items-center rounded-control border border-line px-7 font-semibold hover:border-accent">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const { movie, cinema, screen, showtime, seats, subtotal, fee, total, api } = details;

  async function reserve() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { booking } = await bookingsApi.create(
        { showtime: draft.showtimeId, seats: draft.seatIds, ...(promo.trim() ? { promo_code: promo.trim() } : {}) },
        draft.idempotencyKey,
      );
      clearDraft();
      router.push(routes.booking(booking.id));
    } catch (e) {
      if (!(e instanceof ApiError)) return setError({ message: "Something went wrong. Please try again." });
      if (e.code === "seats_unavailable") setError({ message: "Some seats were just taken. Please choose different seats.", seats: e.errors.seats });
      else if (e.fieldError("promo_code")) setError({ message: e.fieldError("promo_code")!, field: "promo" });
      else if (e.code === "email_unverified") setError({ message: "Please verify your email address first. Check your inbox, or resend the link from your account page." });
      else if (e.isNetwork) setError({ message: "We could not reach the server. Your request was not lost: try again and you will not be charged twice." });
      else setError({ message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page pb-20 pt-28 sm:pt-32">
      <BackLink href={routes.seats(showtime.id)}>Change seats</BackLink>
      <p className="eyebrow mt-2">Review</p>
      <h1 className="display mt-2 text-4xl sm:text-6xl">Reserve your seats</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-card border border-line bg-elevated p-5 sm:p-6" aria-labelledby="how-it-works">
            <h2 id="how-it-works" className="display text-2xl">
              How it works
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>
                We hold your seats for <strong className="text-foreground">2 hours</strong> while you pay by bank transfer.
              </li>
              <li>Upload your transfer proof. A member of staff verifies it and your tickets are issued.</li>
              <li>If nothing is submitted in time, the seats are released automatically.</li>
            </ol>
            <p className="mt-4 flex items-start gap-2 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              <span>
                Booking as <strong>{user.name}</strong> ({user.email}).
              </span>
            </p>
            {!user.email_verified ? (
              <div className="mt-4">
                <FormMessage>Your email address is not verified yet. You need to verify it before you can reserve seats.</FormMessage>
              </div>
            ) : null}
          </section>

          <section className="rounded-card border border-line bg-elevated p-5 sm:p-6">
            <label htmlFor="promo" className="block text-sm font-semibold">
              Promo code (optional)
            </label>
            <input
              id="promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              maxLength={48}
              autoComplete="off"
              className={inputClass(error?.field === "promo") + " mt-1.5 max-w-xs uppercase"}
              aria-invalid={error?.field === "promo"}
            />
            <p className="mt-1.5 text-sm text-muted">Discounts are calculated and confirmed by the server when you reserve.</p>
          </section>

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-semibold text-accent-text hover:underline">
                terms
              </Link>{" "}
              and understand my seats are held for 2 hours.
            </span>
          </label>

          {error ? (
            <div>
              <FormMessage>
                {error.message}
                {error.seats?.length ? ` (${error.seats.join(", ")})` : ""}
              </FormMessage>
              {error.seats?.length ? (
                <Link href={routes.seats(showtime.id)} className="mt-2 inline-block text-sm font-semibold text-accent-text hover:underline" onClick={() => clearDraft()}>
                  Back to the seat map
                </Link>
              ) : null}
            </div>
          ) : null}

          <Button size="lg" className="w-full sm:w-fit" disabled={!agree || busy || !user.email_verified} onClick={reserve}>
            {busy ? "Reserving…" : "Reserve seats"}
          </Button>
        </div>

        <aside aria-label="Order summary" className="h-fit rounded-card border border-line bg-elevated p-5 shadow-card lg:sticky lg:top-28">
          <h2 className="display text-2xl">{movie.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {cinema.name} · {screen.name}
          </p>
          <p className="text-sm text-muted">
            {formatISODate(showtime.date)} · {formatTime(showtime.time)}
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {seats.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  Seat <strong>{s.id}</strong> <span className="text-muted">· {s.categoryName}</span>
                </span>
                <span>{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Tickets ({seats.length})</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {fee > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">
                  Service fee ({formatPrice(api.fee_per_seat ?? 0)} × {seats.length})
                </dt>
                <dd>{formatPrice(fee)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Final amount is confirmed by the server when you reserve.
          </p>
        </aside>
      </div>
    </div>
  );
}
