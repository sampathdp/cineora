"use client";

import { useEffect } from "react";
import { Clock, Printer } from "lucide-react";
import { clearDraft, useBooking } from "@/lib/booking-store";
import { formatISODate, formatPrice, formatTime } from "@/lib/formatters";
import { CATEGORY_LABEL } from "@/lib/seats";
import { hashString, seededRandom } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { DemoNotice, Skeleton } from "@/components/ui/misc";
import { MissingBooking, useBookingDetails } from "./booking-context";

/** Decorative QR-style pattern generated from the reference. NOT scannable and not a valid ticket. */
function QrPlaceholder({ value }: { value: string }) {
  const size = 25;
  const rand = seededRandom(hashString(value));
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    const boxes: [number, number][] = [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ];
    for (const [ox, oy] of boxes) {
      if (inBox(ox, oy)) {
        const lx = x - ox;
        const ly = y - oy;
        return lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      }
    }
    return null;
  };
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      const on = f ?? rand() > 0.52;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} role="img" aria-label="Decorative QR-style placeholder, not scannable" className="size-40 rounded bg-white p-1" fill="#111">
      {cells}
    </svg>
  );
}

export function Confirmation() {
  const stored = useBooking();
  const details = useBookingDetails(stored);

  // The draft has served its purpose once a booking exists.
  useEffect(() => {
    if (stored) clearDraft();
  }, [stored]);

  if (stored === undefined) {
    return (
      <div className="container-page pt-32">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!stored || !details) {
    return (
      <MissingBooking
        title="No booking found"
        message="There is no demo booking in this browser session. Start from a movie to try the flow."
      />
    );
  }

  const { movie, cinema, screen, showtime, seats, subtotal, fee } = details;

  return (
    <div className="container-page pb-20 pt-28 sm:pt-32">
      <div className="no-print">
        <p className="eyebrow">Demo booking received</p>
        <h1 className="display mt-2 text-4xl sm:text-6xl">Thank you, {stored.customer.fullName.split(" ")[0]}</h1>
        <DemoNotice className="mt-6">
          This is a demonstration ticket, not a real admission ticket. No payment was processed or verified.
        </DemoNotice>
      </div>

      <article className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-card border border-line bg-elevated shadow-card">
        <div className="on-dark bg-black p-6 sm:p-8">
          <p className="eyebrow">Demo ticket · not valid for entry</p>
          <h2 className="display mt-2 text-4xl sm:text-5xl">{movie.title}</h2>
          <p className="mt-2 text-white/80">
            {cinema.name} · {screen.name}
          </p>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Item label="Booking reference" value={<span className="font-mono text-lg font-bold">{stored.reference}</span>} />
            <Item label="Date" value={<span suppressHydrationWarning>{formatISODate(stored.dateISO)}</span>} />
            <Item label="Time" value={formatTime(showtime.time)} />
            <Item label="Seats" value={seats.map((s) => `${s.id} (${CATEGORY_LABEL[s.category]})`).join(", ")} />
            <Item label="Name" value={stored.customer.fullName} />
            <Item label="Total (incl. demo fee)" value={formatPrice(subtotal + fee)} />
            <Item
              label="Payment status"
              value={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 font-semibold text-accent-text">
                  <Clock className="size-3.5" aria-hidden /> Awaiting Manual Verification
                </span>
              }
            />
            {stored.paymentReference ? <Item label="Transfer reference" value={stored.paymentReference} /> : null}
          </dl>
          <div className="flex flex-col items-center gap-2">
            <QrPlaceholder value={stored.reference} />
            <p className="max-w-40 text-center text-xs text-muted">Decorative placeholder. Not a scannable code.</p>
          </div>
        </div>
        <p className="border-t border-dashed border-line px-6 py-3 text-center text-xs text-muted sm:px-8">
          Frontend demonstration only. No real booking, payment verification or ticket issuance has occurred.
        </p>
      </article>

      <div className="no-print mx-auto mt-8 flex max-w-3xl flex-wrap gap-3">
        <Button onClick={() => window.print()} variant="secondary" size="lg">
          <Printer className="size-5" aria-hidden /> Print / Save as PDF
        </Button>
        <LinkButton href="/movies" size="lg">
          Book another movie
        </LinkButton>
        <LinkButton href="/" size="lg" variant="ghost">
          Back to Home
        </LinkButton>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
