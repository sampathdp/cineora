"use client";

import type { ApiShowtime } from "@/lib/api/catalog";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";
import { BackLink } from "@/components/ui/misc";
import { LiveSeatMap } from "./live-seat-map";

export function SeatPicker({ showtime }: { showtime: ApiShowtime }) {
  const { date, time } = zonedParts(showtime.starts_at, showtime.cinema.timezone);

  return (
    <div className="container-page pb-32 pt-28 sm:pt-32 lg:pb-16">
      <BackLink href={`/movies/${showtime.movie.slug}`}>Back to movie</BackLink>
      <header className="mt-2">
        <p className="eyebrow">Select seats</p>
        <h1 className="display mt-2 text-4xl sm:text-6xl">{showtime.movie.title}</h1>
        <p className="mt-2 text-muted">
          {showtime.cinema.name} · {showtime.room.name} · {formatISODate(date, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(time)}
        </p>
      </header>

      <p className="mt-4 text-sm text-muted">Availability and prices are live from the server. Seats are only held once you reserve them at the next step.</p>

      <div className="mt-6">
        <LiveSeatMap showtime={showtime} />
      </div>
    </div>
  );
}
