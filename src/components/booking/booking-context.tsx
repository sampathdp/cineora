"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getShowtime } from "@/data/showtimes";
import { getMovie } from "@/data/movies";
import { getCinema } from "@/data/cinemas";
import { buildSeats } from "@/lib/seats";
import type { BookingDraft } from "@/types/booking";

export const SERVICE_FEE_PER_SEAT = 1;

/** Resolves everything a booking step needs to display from a draft/booking. */
export function useBookingDetails(draft: Pick<BookingDraft, "showtimeId" | "seatIds"> | null | undefined) {
  return useMemo(() => {
    if (!draft) return null;
    const showtime = getShowtime(draft.showtimeId);
    const movie = showtime && getMovie(showtime.movieSlug);
    const cinema = showtime && getCinema(showtime.cinemaSlug);
    const screen = cinema?.screens.find((s) => s.id === showtime?.screenId);
    if (!showtime || !movie || !cinema || !screen) return null;
    const seats = buildSeats(screen, showtime.id)
      .flat()
      .filter((s) => draft.seatIds.includes(s.id) && !s.unavailable);
    const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
    const fee = seats.length * SERVICE_FEE_PER_SEAT;
    return { showtime, movie, cinema, screen, seats, subtotal, fee, total: subtotal + fee };
  }, [draft]);
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
