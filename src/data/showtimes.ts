import type { Showtime } from "@/types/cinema";
import { cinemas } from "./cinemas";
import { nowPlaying } from "./movies";

const TIMES = ["10:30", "13:15", "16:00", "18:45", "21:30"];
export const DAYS_AHEAD = 7;

/**
 * Mock schedule, generated deterministically. The single hall rotates
 * through now-playing titles. These are NOT real screening times.
 */
function generate(): Showtime[] {
  const out: Showtime[] = [];
  const cinema = cinemas[0];
  const screen = cinema.screens[0];
  for (let day = 0; day < DAYS_AHEAD; day++) {
    TIMES.forEach((time, slot) => {
      const movie = nowPlaying[(day * TIMES.length + slot) % nowPlaying.length];
      out.push({
        id: `${cinema.slug}_${movie.slug}_${day}_${time.replace(":", "")}`,
        movieSlug: movie.slug,
        cinemaSlug: cinema.slug,
        screenId: screen.id,
        dayOffset: day,
        time,
      });
    });
  }
  return out;
}

export const showtimes: Showtime[] = generate();
const byId = new Map(showtimes.map((s) => [s.id, s]));

export const getShowtime = (id: string) => byId.get(id);
export const showtimesFor = (filter: { movieSlug?: string; cinemaSlug?: string }) =>
  showtimes.filter(
    (s) =>
      (!filter.movieSlug || s.movieSlug === filter.movieSlug) &&
      (!filter.cinemaSlug || s.cinemaSlug === filter.cinemaSlug),
  );
export const cinemasForMovie = (movieSlug: string) =>
  cinemas.filter((c) => showtimes.some((s) => s.movieSlug === movieSlug && s.cinemaSlug === c.slug));
export const moviesForCinema = (cinemaSlug: string) =>
  nowPlaying.filter((m) => showtimes.some((s) => s.movieSlug === m.slug && s.cinemaSlug === cinemaSlug));
