"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSeats, fetchShowtime, type ApiShowtime } from "@/lib/api/catalog";
import { zonedParts } from "@/lib/formatters";
import { groupSeats } from "@/lib/seats";
import type { BookingDraft, Seat } from "@/types/booking";

export interface BookingDetails {
  showtime: { id: string; time: string; date: string; startsAt: string };
  movie: { slug: string; title: string };
  cinema: { slug: string; name: string };
  screen: { name: string };
  seats: Seat[];
  subtotal: number;
  fee: number;
  total: number;
  api: ApiShowtime;
}

interface Loaded {
  showtimeId: string;
  api: ApiShowtime | null;
  seats: Seat[];
  failed?: boolean;
}

/**
 * Resolves what a booking step displays from a draft, using live server data.
 * Returns `undefined` while loading and `null` when the draft cannot be shown (missing, closed, unavailable seats).
 * Amounts here are for display; the server calculates the real total when the booking is created.
 */
export function useBookingDetails(draft: Pick<BookingDraft, "showtimeId" | "seatIds"> | null | undefined): BookingDetails | null | undefined {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const showtimeId = draft?.showtimeId;

  useEffect(() => {
    if (!showtimeId) return;
    const controller = new AbortController();
    Promise.all([fetchShowtime(showtimeId, controller.signal), fetchSeats(showtimeId, controller.signal).catch(() => null)])
      .then(([api, map]) => setLoaded({ showtimeId, api, seats: map ? groupSeats(map.seats).flat() : [] }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ showtimeId, api: null, seats: [], failed: true });
      });
    return () => controller.abort();
  }, [showtimeId]);

  return useMemo(() => {
    if (draft === undefined) return undefined;
    if (draft === null) return null;
    if (loaded?.showtimeId !== draft.showtimeId) return undefined;
    if (!loaded.api || loaded.failed) return null;

    const seats = loaded.seats.filter((s) => draft.seatIds.includes(s.id) && !s.unavailable);
    const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
    const fee = seats.length * (loaded.api.fee_per_seat ?? 0);
    const { date, time } = zonedParts(loaded.api.starts_at, loaded.api.cinema.timezone);
    return {
      showtime: { id: loaded.api.id, time, date, startsAt: loaded.api.starts_at },
      movie: { slug: loaded.api.movie.slug, title: loaded.api.movie.title },
      cinema: { slug: loaded.api.cinema.slug, name: loaded.api.cinema.name },
      screen: { name: loaded.api.room.name },
      seats,
      subtotal,
      fee,
      total: subtotal + fee,
      api: loaded.api,
    };
  }, [draft, loaded]);
}

export function MissingBooking({ title, message }: { title: string; message: string }) {
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-28 text-center">
      <h1 className="display text-4xl sm:text-6xl">{title}</h1>
      <p className="max-w-md text-muted">{message}</p>
      <Link
        href="/movies"
        className="inline-flex min-h-12 items-center rounded-control bg-accent px-7 font-semibold text-on-accent hover:bg-accent-hover"
      >
        Browse movies
      </Link>
    </section>
  );
}
