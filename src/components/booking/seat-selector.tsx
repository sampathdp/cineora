"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Box, Check } from "lucide-react";
import type { Seat } from "@/types/booking";
import type { ApiShowtime } from "@/lib/api/catalog";
import { siteConfig } from "@/config/site";
import { saveDraft } from "@/lib/booking-store";
import { formatPrice, zonedParts } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  showtime: ApiShowtime;
  rows: Seat[][];
  /** False once ticket sales for this showtime have closed. */
  bookable: boolean;
  /** Inline on the movie page: summary sits under the map instead of in a sidebar. */
  embedded?: boolean;
}

const catStyle: Record<string, string> = {
  standard: "border-black/25 bg-foreground/15 text-foreground hover:-translate-y-0.5 hover:bg-foreground/30",
  premium: "border-black/25 bg-accent/25 text-foreground hover:-translate-y-0.5 hover:bg-accent/50",
  lounge: "border-black/25 bg-violet-400/30 text-foreground hover:-translate-y-0.5 hover:bg-violet-400/55",
};
const fallbackStyle = "border-black/25 bg-sky-400/30 text-foreground hover:-translate-y-0.5 hover:bg-sky-400/55";
const styleFor = (category: string) => catStyle[category] ?? fallbackStyle;

/** Seat map + summary. Saves a draft and continues to checkout. */
export function SeatSelector({ showtime, rows, bookable, embedded = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view3d, setView3d] = useState(true);

  const allSeats = useMemo(() => rows.flat(), [rows]);
  const chosen = useMemo(() => allSeats.filter((s) => selected.includes(s.id)), [allSeats, selected]);
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const max = siteConfig.maxSeatsPerBooking;

  const prices = useMemo(() => {
    const map = new Map<string, { name: string; price: number }>();
    allSeats.forEach((s) => map.set(s.category, { name: s.categoryName, price: s.price }));
    return Array.from(map.entries());
  }, [allSeats]);

  function toggle(seat: Seat) {
    if (seat.unavailable) return;
    setError(null);
    if (selected.includes(seat.id)) {
      setSelected(selected.filter((id) => id !== seat.id));
    } else if (selected.length >= max) {
      setError(`You can select up to ${max} seats per booking. Deselect a seat to choose another.`);
    } else {
      setSelected([...selected, seat.id]);
    }
  }

  function onContinue() {
    if (!bookable) {
      setError("Ticket sales for this showtime have closed.");
      return;
    }
    if (!chosen.length) {
      setError("Select at least one seat to continue.");
      return;
    }
    saveDraft({
      showtimeId: showtime.id,
      dateISO: zonedParts(showtime.starts_at, showtime.cinema.timezone).date,
      seatIds: selected,
      createdAt: Date.now(),
    });
    router.push("/booking/checkout");
  }

  const maxCol = Math.max(...allSeats.map((s) => s.col), 1);
  const mid = Math.floor(maxCol / 2);
  // Grid track 1 is the row letter and track mid+2 the centre aisle; walkway gaps are simply unused columns.
  const trackOf = (col: number) => (col <= mid ? col + 1 : col + 2);

  const map = (
    <section aria-label="Seat map" className="min-w-0">
      <div className="mb-5 flex flex-wrap gap-2 text-xs" aria-label="Legend" role="group">
        <LegendItem label="Available" swatch={<span className="size-4 rounded-t-md border border-foreground/30 bg-foreground/10" />} />
        <LegendItem
          label="Selected"
          swatch={
            <span className="grid size-4 place-items-center rounded-t-md bg-accent text-on-accent">
              <Check className="size-3" aria-hidden />
            </span>
          }
        />
        <LegendItem
          label="Unavailable"
          swatch={
            <span className="size-4 rounded-t-md bg-foreground/5" />
          }
        />
        {prices.map(([cat, info]) => (
          <LegendItem
            key={cat}
            label={`${info.name} ${formatPrice(info.price)}`}
            swatch={<span className={cn("size-4 rounded-t-md border", styleFor(cat))} />}
          />
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-accent/10 via-surface to-surface px-3 pb-8 pt-5 sm:px-8">
        <button
          type="button"
          aria-pressed={view3d}
          onClick={() => setView3d((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-line bg-elevated/80 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:border-accent"
        >
          <Box className="size-3.5" aria-hidden /> {view3d ? "3D view" : "Flat view"}
        </button>

        <div className="mx-auto mt-2 max-w-2xl px-2 sm:px-4" style={{ perspective: "1100px" }}>
          <div aria-hidden className="relative mx-auto mb-8 w-[88%]">
            <div className="h-10 rounded-[50%] border-t-[3px] border-accent shadow-[0_-12px_40px_-6px_var(--accent)]" />
            <div className="pointer-events-none absolute inset-x-6 top-3 h-24 bg-gradient-to-b from-accent/25 to-transparent [clip-path:polygon(0_0,100%_0,100%_40%,92%_100%,8%_100%,0_40%)]" />
            <p className="relative mt-3 text-center text-[0.65rem] uppercase tracking-[0.6em] text-muted">Screen</p>
          </div>

          <div
            role="group"
            aria-label="Seats"
            className="flex flex-col gap-1.5 transition-transform duration-700 ease-out sm:gap-2"
            style={{ transform: view3d ? "rotateX(14deg)" : "none", transformOrigin: "50% 0%" }}
          >
            {rows.map((row) => (
              <div
                key={row[0].row}
                className="grid items-center gap-x-1 sm:gap-x-1.5"
                style={{ gridTemplateColumns: `1.25rem repeat(${mid}, minmax(0, 1fr)) 1.5rem repeat(${maxCol - mid}, minmax(0, 1fr)) 1.25rem` }}
              >
                <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted" style={{ gridColumnStart: 1 }}>
                  {row[0].row}
                </span>
                {row.map((seat) => {
                  const isSel = selected.includes(seat.id);
                  return (
                    <span key={seat.id} className="flex" style={{ gridColumnStart: trackOf(seat.col) }}>
                      <button
                        type="button"
                        disabled={seat.unavailable}
                        aria-pressed={seat.unavailable ? undefined : isSel}
                        aria-label={`Seat ${seat.id}, ${seat.categoryName}, ${formatPrice(seat.price)}${seat.unavailable ? ", unavailable" : isSel ? ", selected" : ""}`}
                        onClick={() => toggle(seat)}
                        className={cn(
                          "grid aspect-square w-full max-w-11 place-items-center rounded-t-lg rounded-b-[0.3rem] border-b-[3px] text-[0.6rem] font-semibold transition duration-150 sm:text-xs",
                          seat.unavailable
                            ? "cursor-not-allowed border-transparent bg-foreground/5 text-transparent"
                            : isSel
                              ? "-translate-y-0.5 border-black/30 bg-accent text-on-accent shadow-[0_8px_20px_-4px_var(--accent)]"
                              : styleFor(seat.category),
                        )}
                      >
                        {seat.unavailable ? null : isSel ? <Check className="size-3.5 sm:size-4" aria-hidden /> : seat.number}
                      </button>
                    </span>
                  );
                })}
                <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted" style={{ gridColumnStart: maxCol + 3 }}>
                  {row[0].row}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  if (embedded) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {map}
        <aside aria-label="Booking summary">
          <div className="sticky top-28 rounded-3xl border border-line bg-elevated p-5 shadow-card">
            <Summary chosen={chosen} subtotal={subtotal} max={max} error={error} onContinue={onContinue} />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        {map}
        <aside aria-label="Booking summary" className="hidden lg:block">
          <div className="sticky top-28 rounded-card border border-line bg-elevated p-5 shadow-card">
            <Summary chosen={chosen} subtotal={subtotal} max={max} error={error} onContinue={onContinue} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky summary */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-lg">
          {error ? <ErrorLine error={error} /> : null}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              <p className="truncate text-sm text-muted">
                {chosen.length ? `${chosen.length} seat${chosen.length > 1 ? "s" : ""}: ${chosen.map((s) => s.id).join(", ")}` : "No seats selected"}
              </p>
              <p className="display text-2xl">{formatPrice(subtotal)}</p>
            </div>
            <Button onClick={onContinue} size="lg">
              Continue
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-foreground/5 px-3 py-1.5 text-muted">
      {swatch} {label}
    </span>
  );
}

function ErrorLine({ error }: { error: string }) {
  return (
    <p role="alert" className="mb-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
    </p>
  );
}

function Summary({
  chosen,
  subtotal,
  max,
  error,
  onContinue,
}: {
  chosen: Seat[];
  subtotal: number;
  max: number;
  error: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      <h2 className="display text-2xl">Your seats</h2>
      <div aria-live="polite" className="mt-4 min-h-24">
        {chosen.length === 0 ? (
          <p className="text-sm text-muted">Choose up to {max} seats from the map.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {chosen.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  <strong>{s.id}</strong> <span className="text-muted">· {s.categoryName}</span>
                </span>
                <span>{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Quantity</dt>
          <dd>
            {chosen.length} / {max}
          </dd>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <dt>Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
      </dl>
      {error ? (
        <div className="mt-3">
          <ErrorLine error={error} />
        </div>
      ) : null}
      <Button onClick={onContinue} size="lg" className="mt-4 w-full">
        Continue to checkout
      </Button>
    </>
  );
}
