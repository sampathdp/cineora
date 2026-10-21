"use client";

import type { Seat } from "@/types/booking";
import type { Showtime } from "@/types/cinema";
import { formatDate, formatTime } from "@/lib/formatters";
import { useDays } from "@/lib/use-today";
import { BackLink, DemoNotice } from "@/components/ui/misc";
import { SeatSelector } from "./seat-selector";

interface Props {
  showtime: Showtime;
  movieTitle: string;
  movieSlug: string;
  cinemaName: string;
  screenName: string;
  rows: Seat[][];
}

export function SeatPicker({ showtime, movieTitle, movieSlug, cinemaName, screenName, rows }: Props) {
  const days = useDays(8);
  const date = days?.[showtime.dayOffset];

  return (
    <div className="container-page pb-32 pt-28 sm:pt-32 lg:pb-16">
      <BackLink href={`/movies/${movieSlug}`}>Back to movie</BackLink>
      <header className="mt-2">
        <p className="eyebrow">Select seats</p>
        <h1 className="display mt-2 text-4xl sm:text-6xl">{movieTitle}</h1>
        <p className="mt-2 text-muted">
          {cinemaName} · {screenName} ·{" "}
          <span suppressHydrationWarning>
            {date ? formatDate(date, { weekday: "short", day: "numeric", month: "short" }) : "…"}
          </span>{" "}
          · {formatTime(showtime.time)}
        </p>
      </header>

      <DemoNotice className="mt-6">
        Unavailable seats are sample states. No real reservation or seat locking takes place.
      </DemoNotice>

      <SeatSelector showtime={showtime} rows={rows} date={date} />
    </div>
  );
}
