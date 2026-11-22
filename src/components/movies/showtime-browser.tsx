"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  MapPin,
  Sparkles,
  Ticket,
  Volume2,
  Zap,
} from "lucide-react";
import { fetchShowtimes, type ApiShowtime } from "@/lib/api/catalog";
import { formatISODate, formatPrice, formatTime, zonedParts } from "@/lib/formatters";
import { LiveSeatMap } from "@/components/booking/live-seat-map";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

interface Loaded {
  slug: string;
  items?: ApiShowtime[];
  error?: string;
}

export function ShowtimeBrowser({ slug }: { slug: string }) {
  const [state, setState] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const datesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchShowtimes({ movie: slug }, controller.signal)
      .then((items) => setState({ slug, items }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ slug, error: "Could not load showtimes. Check your connection and try again." });
        }
      });
    return () => controller.abort();
  }, [slug, attempt]);

  const loaded = state?.slug === slug ? state : null;

  // Group showtimes by local calendar date in cinema's timezone
  const byDate = useMemo(() => {
    const map = new Map<string, (ApiShowtime & { time: string; endTime?: string })[]>();
    for (const s of loaded?.items ?? []) {
      const { date, time } = zonedParts(s.starts_at, s.cinema.timezone);
      const endTime = s.film_ends_at ? formatTime(zonedParts(s.film_ends_at, s.cinema.timezone).time) : undefined;
      map.set(date, [...(map.get(date) ?? []), { ...s, time, endTime }]);
    }
    return map;
  }, [loaded]);

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);

  if (!loaded) {
    return (
      <div className="rounded-3xl border border-line/70 bg-surface/50 p-6 sm:p-8 backdrop-blur-sm" aria-busy="true">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-3 mb-8">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <Skeleton className="h-20 w-20 rounded-2xl" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (loaded.error) {
    return (
      <EmptyState
        title="Showtimes unavailable"
        description={loaded.error}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setState(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (dates.length === 0) {
    return (
      <div className="rounded-3xl border border-line/70 bg-surface/50 p-8 sm:p-12 text-center backdrop-blur-sm">
        <Film className="size-12 mx-auto text-muted/50 mb-3" />
        <h3 className="display text-2xl text-foreground">No Showtimes Scheduled Yet</h3>
        <p className="mt-2 text-sm text-muted max-w-md mx-auto">
          Screenings are refreshed weekly. Please check back soon or explore other titles currently playing.
        </p>
      </div>
    );
  }

  const activeDate = pickedDate && byDate.has(pickedDate) ? pickedDate : dates[0];
  const allForDay = [...(byDate.get(activeDate) ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  // Available screen formats for the active date
  const availableFormats = ["all", ...new Set(allForDay.map((s) => s.room.screen_type || "Standard").filter(Boolean))];

  // Filtered showtimes
  const forDay = allForDay.filter((s) => {
    if (selectedFormat === "all") return true;
    return (s.room.screen_type || "Standard") === selectedFormat;
  });

  const picked = allForDay.find((s) => s.id === pickedId) ?? null;

  // Group by cinema
  const cinemas = [...new Set(forDay.map((s) => s.cinema.slug))].map((cs) => {
    const first = forDay.find((s) => s.cinema.slug === cs)!;
    return { slug: cs, name: first.cinema.name, timezone: first.cinema.timezone };
  });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const scrollDates = (direction: "left" | "right") => {
    if (!datesContainerRef.current) return;
    const amount = direction === "left" ? -220 : 220;
    datesContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handleSelectShowtime = (showtimeId: string) => {
    setPickedId(showtimeId);
    setTimeout(() => {
      document.getElementById("auditorium-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-surface/70 dark:bg-surface/30 p-4 sm:p-6 lg:p-8 shadow-xl backdrop-blur-md">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-accent/5 blur-3xl" />

      {/* TOP BAR: Clean summary & Format tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/50 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE SEAT MAP</span>
            </span>
            <span className="text-xs text-muted">Select date and showtime below</span>
          </div>
          <h3 className="display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Screenings &amp; Tickets
          </h3>
        </div>

        {/* Experience format tabs or Dates available count */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {availableFormats.length > 2 && (
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line/60 bg-elevated/80 p-1">
              {availableFormats.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                    selectedFormat === fmt
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {fmt === "all" ? "All Formats" : fmt}
                </button>
              ))}
            </div>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-elevated/80 px-3 py-1 text-xs font-semibold text-muted">
            <Calendar className="size-3.5 text-accent" />
            <span>{dates.length} Days Available</span>
          </span>
        </div>
      </div>

      {/* SECTION 1: SLEEK HORIZONTAL DATE RIBBON */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Calendar className="size-3.5 text-accent" />
            <span>Choose Date</span>
          </span>

          {dates.length > 4 && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollDates("left")}
                className="flex size-7 items-center justify-center rounded-lg border border-line/70 bg-elevated/70 text-muted hover:border-accent hover:text-foreground transition cursor-pointer"
                aria-label="Previous dates"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollDates("right")}
                className="flex size-7 items-center justify-center rounded-lg border border-line/70 bg-elevated/70 text-muted hover:border-accent hover:text-foreground transition cursor-pointer"
                aria-label="Next dates"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Date cards ribbon */}
        <div
          ref={datesContainerRef}
          role="tablist"
          aria-label="Select screening date"
          className="scrollbar-none -mx-2 flex gap-2.5 overflow-x-auto px-2 py-1.5"
        >
          {dates.map((d) => {
            const [y, m, day] = d.split("-").map(Number);
            const dt = new Date(y, m - 1, day);
            const isSelected = activeDate === d;
            const isToday = d === todayStr;
            const isTomorrow = d === tomorrowStr;

            const dayLabel = isToday
              ? "TODAY"
              : isTomorrow
              ? "TMRW"
              : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dt).toUpperCase();

            const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(dt);
            const showCount = byDate.get(d)?.length ?? 0;

            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setPickedDate(d);
                  setPickedId(null);
                }}
                className={cn(
                  "group relative flex min-w-[5rem] sm:min-w-[5.5rem] flex-col items-center justify-between rounded-2xl border p-2.5 sm:p-3 transition-all duration-150 cursor-pointer select-none",
                  isSelected
                    ? "border-accent bg-gradient-to-b from-accent to-accent-hover text-white shadow-lg shadow-accent/25 ring-2 ring-accent/35 scale-[1.02]"
                    : "border-line/70 bg-elevated/70 text-foreground hover:border-accent/60 hover:bg-elevated hover:shadow-sm",
                )}
              >
                {/* Day label */}
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-wider uppercase",
                    isSelected
                      ? "text-white/90"
                      : "text-muted group-hover:text-foreground",
                  )}
                >
                  {dayLabel}
                </span>

                {/* Day number */}
                <span className="display text-2xl sm:text-3xl font-black tracking-tight my-0.5">
                  {day}
                </span>

                {/* Month and show count */}
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <span className={isSelected ? "text-white/90" : "text-muted"}>
                    {monthLabel}
                  </span>
                  <span className={isSelected ? "text-white/60" : "opacity-40"}>·</span>
                  <span
                    className={cn(
                      "rounded px-1 text-[9px] font-bold",
                      isSelected
                        ? "bg-black/25 text-white"
                        : "bg-surface text-muted",
                    )}
                  >
                    {showCount} {showCount === 1 ? "show" : "shows"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: SHOWTIMES BY CINEMA VENUE */}
      <div className="mb-8">
        <div className="space-y-4">
          {cinemas.map((c) => {
            const cinemaShows = forDay.filter((s) => s.cinema.slug === c.slug);
            if (cinemaShows.length === 0) return null;

            return (
              <div
                key={c.slug}
                className="rounded-2xl border border-line/70 bg-elevated/50 p-4 sm:p-5 shadow-sm backdrop-blur-sm"
              >
                {/* Cinema Venue Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/50 pb-3 mb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <MapPin className="size-4" />
                    </div>
                    <h4 className="font-bold text-foreground text-base sm:text-lg">
                      {c.name}
                    </h4>

                    {/* Venue Experience Amenities Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 ml-1">
                      <span className="inline-flex items-center gap-1 rounded-md border border-line/50 bg-surface/80 px-2 py-0.5 text-[11px] font-medium text-muted">
                        <Volume2 className="size-3 text-accent" />
                        <span>Dolby Atmos</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-line/50 bg-surface/80 px-2 py-0.5 text-[11px] font-medium text-muted">
                        <Sparkles className="size-3 text-accent" />
                        <span>4K Laser</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-line/50 bg-surface/80 px-2 py-0.5 text-[11px] font-medium text-muted">
                        <Armchair className="size-3 text-accent" />
                        <span>Luxury Recliners</span>
                      </span>
                    </div>
                  </div>

                  <span className="rounded-full border border-line/60 bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                    {cinemaShows.length} {cinemaShows.length === 1 ? "screening" : "screenings"}
                  </span>
                </div>

                {/* Showtimes Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {cinemaShows.map((s) => {
                    const isSelected = s.id === pickedId;
                    const isSoldOut = s.available_seats === 0;
                    const seats = s.available_seats;
                    const isFillingFast = seats !== undefined && seats > 0 && seats <= 15;
                    const screenFormat = s.room.screen_type || "Standard 2D";

                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={isSoldOut}
                        onClick={() => handleSelectShowtime(s.id)}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none",
                          isSelected
                            ? "border-accent bg-accent/10 shadow-lg shadow-accent/20 ring-2 ring-accent/40 -translate-y-0.5"
                            : isSoldOut
                            ? "border-line/40 bg-surface/30 opacity-50 cursor-not-allowed"
                            : "border-line/70 bg-elevated/90 hover:border-accent hover:bg-elevated hover:shadow-md hover:-translate-y-0.5",
                        )}
                      >
                        {/* Top: Start Time & Screen Format Tag */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <span className="display text-2xl font-bold tracking-tight text-foreground group-hover:text-accent transition">
                              {formatTime(s.time)}
                            </span>
                            {s.endTime && (
                              <span className="block text-xs text-muted font-medium mt-0.5">
                                Until {s.endTime}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                                isSelected
                                  ? "border-accent/40 bg-accent/20 text-accent"
                                  : "border-line/60 bg-surface text-muted",
                              )}
                            >
                              {screenFormat}
                            </span>
                            {isSelected && (
                              <span className="flex size-5 items-center justify-center rounded-full bg-accent text-white shadow-sm">
                                <Check className="size-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Room Name & Sound */}
                        <div className="my-2.5 flex items-center justify-between text-xs text-muted">
                          <span className="font-semibold text-foreground truncate">{s.room.name}</span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Volume2 className="size-3 opacity-70" />
                            <span>Atmos</span>
                          </span>
                        </div>

                        {/* Bottom: Seats Availability & Starting Price */}
                        <div className="flex items-center justify-between border-t border-line/40 pt-2.5 text-xs">
                          {isSoldOut ? (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 font-bold text-rose-500">
                              Sold Out
                            </span>
                          ) : isFillingFast ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-bold text-amber-500">
                              🔥 {seats} left
                            </span>
                          ) : seats !== undefined ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              <span>{seats} seats</span>
                            </span>
                          ) : (
                            <span className="text-muted">Available</span>
                          )}

                          <span className="font-extrabold text-accent text-sm sm:text-base">
                            {s.from_price !== null ? formatPrice(s.from_price) : "—"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: AUDITORIUM LIVE SEATING OR SLEEK PREVIEW BANNER */}
      <div id="auditorium-view" className="scroll-mt-24">
        {picked ? (
          <div className="rounded-2xl border border-accent/40 bg-elevated/90 p-4 sm:p-7 shadow-2xl backdrop-blur-md">
            {/* Active Showtime Selection Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4 mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                  <Zap className="size-3" />
                  <span>STEP 2: CHOOSE YOUR SEATS</span>
                </span>
                <h3 className="display text-2xl font-bold text-foreground mt-1">
                  {picked.cinema.name} · {picked.room.name}
                </h3>
                <p className="text-xs sm:text-sm text-muted mt-0.5 flex flex-wrap items-center gap-2">
                  <Clock className="size-3.5 text-accent" />
                  <span className="font-medium text-foreground">
                    {formatISODate(activeDate)} · {formatTime(picked.time)}
                    {picked.endTime ? ` – ${picked.endTime}` : ""}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-accent">{picked.room.screen_type || "Standard 2D"}</span>
                  {picked.from_price ? (
                    <>
                      <span>·</span>
                      <span className="text-muted">From {formatPrice(picked.from_price)}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPickedId(null)}
                  className="text-xs cursor-pointer"
                >
                  Change Showtime
                </Button>
              </div>
            </div>

            {/* Embedded Live Seat Map */}
            <LiveSeatMap key={picked.id} showtime={picked} embedded />
          </div>
        ) : (
          /* Sleek Cinema Auditorium Stage Preview */
          <div className="relative overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-surface/70 via-elevated/40 to-surface/70 p-6 sm:p-8 text-center shadow-inner">
            {/* Luminous Curved Screen Graphic */}
            <div className="relative mx-auto max-w-sm mb-4">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_16px_var(--accent)]" />
              <p className="mt-2 text-[9px] font-extrabold uppercase tracking-[0.3em] text-muted">
                AUDITORIUM STAGE SCREEN
              </p>
              {/* Soft projection light cone */}
              <div className="pointer-events-none mx-auto mt-1 h-8 w-2/3 bg-gradient-to-b from-accent/15 via-accent/5 to-transparent blur-lg" />
            </div>

            <div className="max-w-md mx-auto">
              <div className="inline-flex items-center justify-center size-10 rounded-xl bg-accent/15 text-accent mb-2 shadow-sm border border-accent/20">
                <Armchair className="size-5" />
              </div>
              <h4 className="display text-xl font-bold text-foreground">
                Select a Showtime to Reserve Seats
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-muted">
                Click any screening time above to open the live auditorium seat map and choose your seats.
              </p>

              {/* Theater experience perks */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
                <span className="flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/80 px-2.5 py-0.5">
                  <Armchair className="size-3 text-accent" />
                  <span>Real-Time Seating</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/80 px-2.5 py-0.5">
                  <Volume2 className="size-3 text-accent" />
                  <span>Dolby Atmos Sound</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/80 px-2.5 py-0.5">
                  <Ticket className="size-3 text-accent" />
                  <span>Instant Mobile Ticket</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
