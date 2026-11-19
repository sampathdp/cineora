"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, Ticket } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { STATUS_LABEL, bookingsApi, type ApiBooking } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/client";
import { formatISODate, formatPrice, formatTime, zonedParts } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { BackLink, EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
import { PaymentPanel } from "./payment-panel";
import { TicketList } from "./ticket-cards";
import { paymentsApi, type TicketInfo } from "@/lib/api/payments";
import { cn } from "@/lib/utils";

/** Seconds left until `iso`, measured on the server's clock (so a wrong device clock cannot mislead). Informational only. */
function useCountdown(iso: string | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.parse(iso) - (now + offset)) / 1000));
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function StatusBadge({ status }: { status: ApiBooking["status"] }) {
  const tone =
    status === "CONFIRMED" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : status === "PENDING_PAYMENT" || status === "PAYMENT_REVIEW" ? "bg-accent/15 text-accent-text"
    : status === "EXPIRED" || status === "CANCELLED" ? "bg-foreground/10 text-muted"
    : "bg-red-500/15 text-red-600 dark:text-red-400";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>{STATUS_LABEL[status]}</span>;
}

function useRequireLogin() {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  return status === "authenticated";
}

export function BookingView({ id }: { id: string }) {
  const authed = useRequireLogin();
  const [state, setState] = useState<{ id: string; booking?: ApiBooking; offset?: number; error?: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [tickets, setTickets] = useState<TicketInfo[] | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    let live = true;
    bookingsApi
      .get(id)
      .then(({ booking, serverNow }) => live && setState({ id, booking, offset: serverNow ? Date.parse(serverNow) - Date.now() : 0 }))
      .catch((e: unknown) => live && setState({ id, error: e instanceof ApiError && e.status === 404 ? "We could not find that booking." : "Could not load this booking. Please try again." }));
    return () => {
      live = false;
    };
  }, [authed, id, nonce]);

  const loaded = state?.id === id ? state : null;
  const booking = loaded?.booking;
  const status = booking?.status;
  useEffect(() => {
    if (!authed || status !== "CONFIRMED") return;
    let live = true;
    paymentsApi.tickets(id).then((t) => live && setTickets(t)).catch(() => live && setTickets([]));
    return () => {
      live = false;
    };
  }, [authed, id, status]);

  const left = useCountdown(booking?.status === "PENDING_PAYMENT" ? booking.hold_expires_at : undefined, loaded?.offset ?? 0);

  if (!authed || !loaded) {
    return (
      <section className="container-page pb-16 pt-32" aria-busy="true">
        <Skeleton className="h-72" />
      </section>
    );
  }
  if (!booking) {
    return (
      <section className="container-page pb-16 pt-32">
        <EmptyState title="Booking unavailable" description={loaded.error} action={<Link href="/account/bookings" className="font-semibold text-accent-text hover:underline">My bookings</Link>} />
      </section>
    );
  }

  const st = booking.showtime;
  const when = st ? zonedParts(st.starts_at, st.cinema.timezone) : null;
  const pending = booking.status === "PENDING_PAYMENT";

  async function requestRefund() {
    if (!booking) return;
    const reason = window.prompt("Why would you like a refund? (at least 5 characters)");
    if (!reason || reason.trim().length < 5) return;
    setRefundBusy(true);
    setActionError(null);
    try {
      await paymentsApi.requestRefund(booking.id, reason.trim());
      setNonce((n) => n + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not send the request.");
    } finally {
      setRefundBusy(false);
    }
  }

  async function cancel() {
    if (!booking || !window.confirm("Cancel this booking and release your seats?")) return;
    setCancelling(true);
    setActionError(null);
    try {
      const updated = await bookingsApi.cancel(booking.id);
      setState((s) => (s ? { ...s, booking: updated } : s));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not cancel right now.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="container-page pb-20 pt-28 sm:pt-32">
      <BackLink href="/account/bookings">My bookings</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="eyebrow">Booking</p>
        <StatusBadge status={booking.status} />
      </div>
      <h1 className="display mt-2 text-4xl sm:text-6xl">{st?.movie.title ?? "Your booking"}</h1>
      <p className="mt-2 font-mono text-lg font-bold">{booking.reference}</p>

      {pending && left !== null ? (
        <div role="timer" aria-live="off" className={cn("mt-6 flex flex-wrap items-center gap-3 rounded-card border p-4", left > 0 ? "border-accent/50 bg-accent/10" : "border-line bg-surface")}>
          <Clock className="size-5 text-accent-text" aria-hidden />
          {left > 0 ? (
            <p>
              Seats held for <strong className="tabular-nums">{fmt(left)}</strong>. The server decides when the hold ends; this clock is a guide.
            </p>
          ) : (
            <p>The hold has ended. If it has not been renewed by a submitted payment, the seats are being released.</p>
          )}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {st && when ? (
            <section className="rounded-card border border-line bg-elevated p-5 sm:p-6">
              <h2 className="display text-2xl">Showtime</h2>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <Item label="Cinema" value={`${st.cinema.name} · ${st.room.name}`} />
                <Item label="Date" value={formatISODate(when.date)} />
                <Item label="Time" value={formatTime(when.time)} />
                <Item label="Seats" value={booking.seats.map((s) => s.label).join(", ")} />
              </dl>
            </section>
          ) : null}

          <PaymentPanel booking={booking} onChanged={() => setNonce((n) => n + 1)} />
          {booking.status === "CONFIRMED" ? (
            <section aria-labelledby="tickets-heading">
              <h2 id="tickets-heading" className="display mb-3 text-2xl">
                Your tickets
              </h2>
              {tickets === null ? <Skeleton className="h-48" /> : tickets.length ? <TicketList tickets={tickets} /> : <p className="text-muted">Your tickets are being prepared. Refresh in a moment.</p>}
            </section>
          ) : null}
          {booking.status === "EXPIRED" || booking.status === "CANCELLED" ? (
            <p className="rounded-card border border-dashed border-line p-6 text-center text-muted">
              These seats were released.{" "}
              <Link href="/movies" className="font-semibold text-accent-text hover:underline">
                Find another showing
              </Link>
            </p>
          ) : null}

          {actionError ? <FormMessage>{actionError}</FormMessage> : null}
          {booking.status === "CONFIRMED" ? (
            <div>
              <Button variant="secondary" onClick={requestRefund} disabled={refundBusy}>
                {refundBusy ? "Sending…" : "Request a refund"}
              </Button>
            </div>
          ) : null}
          {pending || booking.status === "PAYMENT_REJECTED" ? (
            <div>
              <Button variant="secondary" onClick={cancel} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </Button>
            </div>
          ) : null}
        </div>

        <aside aria-label="Amount" className="h-fit rounded-card border border-line bg-elevated p-5 shadow-card">
          <h2 className="display flex items-center gap-2 text-2xl">
            <Ticket className="size-5 text-accent-text" aria-hidden /> Order
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {booking.seats.map((s) => (
              <li key={s.label} className="flex justify-between py-2">
                <span>
                  Seat <strong>{s.label}</strong> <span className="text-muted">· {s.category}</span>
                </span>
                <span>{formatPrice(s.unit_price)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 text-sm">
            <Row label="Tickets" value={formatPrice(booking.subtotal)} />
            {booking.discount > 0 ? <Row label="Discount" value={`− ${formatPrice(booking.discount)}`} /> : null}
            {booking.fee > 0 ? <Row label="Service fee" value={formatPrice(booking.fee)} /> : null}
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(booking.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function BookingList() {
  const authed = useRequireLogin();
  const [state, setState] = useState<{ bookings?: ApiBooking[]; error?: string } | null>(null);

  useEffect(() => {
    if (!authed) return;
    let live = true;
    bookingsApi
      .list()
      .then(({ bookings }) => live && setState({ bookings }))
      .catch(() => live && setState({ error: "Could not load your bookings. Please try again." }));
    return () => {
      live = false;
    };
  }, [authed]);

  return (
    <section className="container-page pb-20 pt-28 sm:pt-32">
      <BackLink href="/account">Account</BackLink>
      <h1 className="display mt-2 text-4xl sm:text-6xl">My bookings</h1>
      <div className="mt-8">
        {!authed || !state ? (
          <Skeleton className="h-40" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : state.bookings?.length === 0 ? (
          <EmptyState title="No bookings yet" description="When you reserve seats they will show up here." action={<Link href="/movies" className="font-semibold text-accent-text hover:underline">Browse movies</Link>} />
        ) : (
          <ul className="grid gap-4">
            {state.bookings?.map((b) => {
              const when = b.showtime ? zonedParts(b.showtime.starts_at, b.showtime.cinema.timezone) : null;
              return (
                <li key={b.id}>
                  <Link href={`/account/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-elevated p-5 transition hover:border-accent">
                    <div className="min-w-0">
                      <p className="display text-2xl">{b.showtime?.movie.title ?? "Booking"}</p>
                      <p className="text-sm text-muted">
                        {when ? `${formatISODate(when.date, { weekday: "short", day: "numeric", month: "short" })} · ${formatTime(when.time)} · ` : ""}
                        {b.seats.map((s) => s.label).join(", ")}
                      </p>
                      <p className="mt-1 font-mono text-sm">{b.reference}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={b.status} />
                      <p className="mt-2 font-semibold">{formatPrice(b.total)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
