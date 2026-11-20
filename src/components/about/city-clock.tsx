"use client";

import { useSyncExternalStore } from "react";

// One shared minute tick for every clock on the page.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 15_000);
  return () => clearInterval(id);
}
const getMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => null;

/** Live local time for a city. Shows only the UTC offset before hydration, so the static export never bakes in build time. */
export function CityClock({
  timeZone,
  offset,
}: {
  timeZone: string;
  offset: string;
}) {
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  const now = minute === null ? null : new Date(minute * 60_000);

  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--";
  const day = now
    ? new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(
        now,
      )
    : "";

  return (
    <p className="flex items-baseline gap-3">
      <time className="display text-5xl tabular-nums sm:text-6xl">{time}</time>
      <span className="text-muted">
        {day ? `${day}, ` : ""}
        {offset}
      </span>
    </p>
  );
}
