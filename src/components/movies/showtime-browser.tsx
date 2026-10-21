"use client";

import { useMemo, useState } from "react";
import { Armchair, Clock, MapPin } from "lucide-react";
import { getCinema } from "@/data/cinemas";
import { DAYS_AHEAD, showtimes } from "@/data/showtimes";
import { buildSeats } from "@/lib/seats";
import { useDays } from "@/lib/use-today";
import { formatDate, formatTime } from "@/lib/formatters";
import { SeatSelector } from "@/components/booking/seat-selector";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Date, then time, then seats, all on the movie page. All schedule data is mock. */
export function ShowtimeBrowser({ slug }: { slug: string }) {
  const days = useDays(DAYS_AHEAD);
  const movieTimes = useMemo(() => showtimes.filter((s) => s.movieSlug === slug), [slug]);
  const firstDay = movieTimes.length ? Math.min(...movieTimes.map((s) => s.dayOffset)) : 0;
  const [day, setDay] = useState(firstDay);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const forDay = useMemo(
    () => movieTimes.filter((s) => s.dayOffset === day).sort((a, b) => a.time.localeCompare(b.time)),
    [movieTimes, day],
  );
  const picked = forDay.find((s) => s.id === pickedId) ?? null;
  const ref = picked ?? movieTimes[0];
  const cinema = getCinema(ref?.cinemaSlug ?? "");
  const screen = cinema?.screens.find((x) => x.id === ref?.screenId);
  const rows = useMemo(() => (picked && screen ? buildSeats(screen, picked.id) : null), [picked, screen]);

  return (
    <div className="flex flex-col gap-10 rounded-3xl border border-line bg-surface/60 p-4 shadow-card sm:p-8">
      <div>
        <StepLabel n={1}>Pick a date</StepLabel>
        <div role="tablist" aria-label="Choose a date" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {Array.from({ length: DAYS_AHEAD }, (_, i) => {
            const d = days?.[i];
            const has = movieTimes.some((s) => s.dayOffset === i);
            return (
              <button
                key={i}
                type="button"
                role="tab"
                disabled={!has}
                aria-selected={day === i}
                onClick={() => {
                  setDay(i);
                  setPickedId(null);
                }}
                className={cn(
                  "flex min-h-20 min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 transition",
                  day === i ? "border-accent bg-accent text-on-accent shadow-[0_10px_30px_-8px_var(--accent)]" : "border-line bg-elevated hover:border-accent",
                  !has && "cursor-not-allowed opacity-40 hover:border-line",
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  {d ? (i === 0 ? "Today" : formatDate(d, { weekday: "short" })) : "…"}
                </span>
                <span className="display text-2xl">{d ? d.getDate() : "–"}</span>
                <span className="text-xs opacity-80">{d ? formatDate(d, { month: "short" }) : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <StepLabel n={2}>Choose a showtime</StepLabel>
        {forDay.length === 0 ? (
          <EmptyState title="No showtimes this day" description="Try another date from the selector above." />
        ) : (
          <div>
            {cinema ? (
              <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent-text">
                  <MapPin className="size-4 text-accent-text" aria-hidden /> {cinema.name}
                </span>
                <span>{screen?.name}</span>
              </p>
            ) : null}
            <ul className="flex flex-wrap gap-3">
              {forDay.map((s) => {
                const active = s.id === pickedId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPickedId(s.id)}
                      className={cn(
                        "flex min-h-12 min-w-28 items-center justify-center rounded-full border px-5 py-2 transition",
                        active ? "border-accent bg-accent text-on-accent shadow-[0_10px_30px_-8px_var(--accent)]" : "border-line bg-elevated hover:border-accent",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <Clock className="size-3.5 opacity-70" aria-hidden /> {formatTime(s.time)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {picked && rows ? (
        <div className="scroll-mt-28" id="seats">
          <StepLabel n={3}>
            <span className="inline-flex items-center gap-2">
              Select your seats <Armchair className="size-5 text-accent-text" aria-hidden />
            </span>
          </StepLabel>
          <SeatSelector key={picked.id} showtime={picked} rows={rows} date={days?.[picked.dayOffset]} embedded />
        </div>
      ) : forDay.length ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Pick a showtime to see the seat map.
        </p>
      ) : null}

      <p className="text-xs text-muted">Mock showtimes and seat availability for demonstration only.</p>
    </div>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-foreground">
      <span className="grid size-7 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent">{n}</span>
      {children}
    </h3>
  );
}
