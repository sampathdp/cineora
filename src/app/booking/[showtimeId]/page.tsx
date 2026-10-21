import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShowtime, showtimes } from "@/data/showtimes";
import { getMovie } from "@/data/movies";
import { getCinema } from "@/data/cinemas";
import { buildSeats } from "@/lib/seats";
import { SeatPicker } from "@/components/booking/seat-picker";

type Params = { showtimeId: string };

export const metadata: Metadata = {
  title: "Select Seats",
  description: "Choose your seats (frontend demo, no real reservation).",
  robots: { index: false },
};

export function generateStaticParams() {
  return showtimes.map((s) => ({ showtimeId: s.id }));
}

export default async function SeatSelectionPage({ params }: { params: Promise<Params> }) {
  const { showtimeId } = await params;
  const showtime = getShowtime(showtimeId);
  const movie = showtime && getMovie(showtime.movieSlug);
  const cinema = showtime && getCinema(showtime.cinemaSlug);
  const screen = cinema?.screens.find((s) => s.id === showtime?.screenId);
  if (!showtime || !movie || !cinema || !screen) notFound();

  const rows = buildSeats(screen, showtime.id);
  return (
    <SeatPicker
      showtime={showtime}
      movieTitle={movie.title}
      movieSlug={movie.slug}
      cinemaName={cinema.name}
      screenName={screen.name}
      rows={rows}
    />
  );
}
