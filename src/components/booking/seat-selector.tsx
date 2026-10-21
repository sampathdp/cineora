"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Box, Check } from "lucide-react";
import type { Seat, SeatCategory } from "@/types/booking";
import type { Showtime } from "@/types/cinema";
import { siteConfig } from "@/config/site";
import { CATEGORY_LABEL } from "@/lib/seats";
import { saveDraft } from "@/lib/booking-store";
import { formatPrice, toISODate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  showtime: Showtime;
  rows: Seat[][];
  date?: Date;
  /** Inline on the movie page: summary sits under the map instead of in a sidebar. */
  embedded?: boolean;
}

const catStyle: Record<SeatCategory, string> = {
  standard: "border-black/25 bg-foreground/15 text-foreground hover:-translate-y-0.5 hover:bg-foreground/30",
  premium: "border-black/25 bg-accent/25 text-foreground hover:-translate-y-0.5 hover:bg-accent/50",
  lounge: "border-black/25 bg-violet-400/30 text-foreground hover:-translate-y-0.5 hover:bg-violet-400/55",
};

/** Seat map + summary. Saves a draft and continues to checkout. */
export function SeatSelector({ showtime, rows, date, embedded = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view3d, setView3d] = useState(true);

  const allSeats = useMemo(() => rows.flat(), [rows]);
  const chosen = useMemo(() => allSeats.filter((s) => selected.includes(s.id)), [allSeats, selected]);
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const max = siteConfig.maxSeatsPerBooking;

  const prices = useMemo(() => {
    const map = new Map<SeatCategory, number>();
    allSeats.forEach((s) => map.set(s.category, s.price));
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
    if (!chosen.length) {
      setError("Select at least one seat to continue.");
      return;
    }
    saveDraft({
      showtimeId: showtime.id,
      dateISO: toISODate(date ?? new Date()),
      seatIds: selected,
      createdAt: Date.now(),
    });
    router.push("/booking/checkout");
  }

  const mid = Math.floor((rows[0]?.length ?? 0) / 2);

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
        {prices.map(([cat, price]) => (
          <LegendItem
            key={cat}
            label={`${CATEGORY_LABEL[cat]} ${formatPrice(price)}`}
            swatch={<span className={cn("size-4 rounded-t-md border", catStyle[cat])} />}
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

        <div className="mx-auto mt-2 max-w-2xl" style={{ perspective: "1100px" }}>
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
                style={{ gridTemplateColumns: `1.25rem repeat(${mid}, minmax(0, 1fr)) 1.5rem repeat(${row.length - mid}, minmax(0, 1fr)) 1.25rem` }}
              >
                <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted">
                  {row[0].row}
                </span>
                {row.map((seat, i) => {
                  const isSel = selected.includes(seat.id);
                  return (
                    <span key={seat.id} className="flex" style={i === mid ? { gridColumnStart: mid + 3 } : undefined}>
                      <button
                        type="button"
                        disabled={seat.unavailable}
                        aria-pressed={seat.unavailable ? undefined : isSel}
                        aria-label={`Seat ${seat.id}, ${CATEGORY_LABEL[seat.category]}, ${formatPrice(seat.price)}${seat.unavailable ? ", unavailable" : isSel ? ", selected" : ""}`}
                        onClick={() => toggle(seat)}
                        className={cn(
                          "grid aspect-square w-full max-w-11 place-items-center rounded-t-lg rounded-b-[0.3rem] border-b-[3px] text-[0.6rem] font-semibold transition duration-150 sm:text-xs",
                          seat.unavailable
                            ? "cursor-not-allowed border-transparent bg-foreground/5 text-transparent"
                            : isSel
                              ? "-translate-y-0.5 border-black/30 bg-accent text-on-accent shadow-[0_8px_20px_-4px_var(--accent)]"
                              : catStyle[seat.category],
                        )}
                      >
                        {seat.unavailable ? null : isSel ? <Check className="size-3.5 sm:size-4" aria-hidden /> : seat.number}
                      </button>
                    </span>
                  );
                })}
                <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted">
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
                  <strong>{s.id}</strong> <span className="text-muted">· {CATEGORY_LABEL[s.category]}</span>
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
