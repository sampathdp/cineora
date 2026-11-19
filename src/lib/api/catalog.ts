import type { ArtSpec } from "@/types/art";
import type { Genre, Movie } from "@/types/movie";
import { API_BASE_URL, ApiError, apiGet } from "./client";

/** Shapes returned by the public catalogue endpoints. */
export interface ApiMovie {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  duration_min: number;
  release_date: string | null;
  age_rating: string | null;
  rating: number | null;
  screening_status: "now_playing" | "coming_soon";
  is_featured: boolean;
  poster_url: string | null;
  banner_url: string | null;
  trailer_url: string | null;
  art_theme: Pick<ArtSpec, "from" | "to" | "accent" | "motif"> | null;
  genres?: { slug: string; name: string }[];
  cast?: { name: string; role: string | null }[];
  crew?: { name: string; job: string }[];
}

export interface ApiCinema {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  facilities?: string[];
  rooms?: { id: string; name: string; screen_type: string; seat_count: number | null }[];
}

export interface ApiShowtime {
  id: string;
  movie: { slug: string; title: string; duration_min: number };
  cinema: { slug: string; name: string; timezone: string };
  room: { id: string; name: string; screen_type: string };
  starts_at: string;
  film_ends_at: string;
  sales_closes_at: string;
  bookable: boolean;
  currency: string;
  prices: { category_key: string; category_name: string; price: number }[];
  from_price: number | null;
  available_seats?: number;
  fee_per_seat?: number;
}

export interface ApiSeat {
  key: string;
  row_label: string;
  number: number;
  category_key: string;
  category_name: string;
  price: number;
  status: "available" | "held" | "sold" | "unavailable";
  x: number | null;
  y: number | null;
}

export interface ShowtimeQuery {
  movie?: string;
  cinema?: string;
  date?: string;
  per_page?: number;
}

export interface MovieQuery {
  screening_status?: "now_playing" | "coming_soon";
  genre?: string;
  q?: string;
  featured?: boolean;
  sort?: "release_date" | "-release_date" | "title" | "-title" | "rating" | "-rating";
  per_page?: number;
}

const FALLBACK_THEME = { from: "#1b1e23", to: "#08090b", accent: "#f0782b", motif: "stars" } as const;

const dayMs = 86_400_000;

/** Maps an API movie onto the shape the existing UI components already consume. */
export function adaptMovie(m: ApiMovie, now: number = Date.now()): Movie {
  const today = Math.floor(now / dayMs) * dayMs;
  const release = m.release_date ? Date.parse(`${m.release_date}T00:00:00Z`) : today;
  const crew = m.crew ?? [];
  return {
    slug: m.slug,
    title: m.title,
    tagline: m.tagline ?? "",
    synopsis: m.description ?? "",
    genres: (m.genres ?? []).map((g) => g.name as Genre),
    durationMin: m.duration_min,
    rating: m.rating ?? 0,
    certificate: m.age_rating ?? "NR",
    status: m.screening_status === "now_playing" ? "now-playing" : "coming-soon",
    releaseOffsetDays: Math.round((release - today) / dayMs),
    director: crew.find((c) => c.job === "director")?.name ?? "",
    writers: crew.filter((c) => c.job === "writer").map((c) => c.name),
    cast: (m.cast ?? []).map((c) => ({ name: c.name, role: c.role ?? "" })),
    trailerUrl: m.trailer_url ?? undefined,
    art: { ...(m.art_theme ?? FALLBACK_THEME), image: m.poster_url ?? undefined, backdrop: m.banner_url ?? m.poster_url ?? undefined },
    featured: m.is_featured,
  };
}

function toQuery(q: MovieQuery) {
  return { ...q, featured: q.featured ? 1 : undefined };
}

/** Works in server components and in the browser. Public data only, so no credentials are sent. */
async function publicGet<T>(path: string, query?: Record<string, string | number | boolean | undefined | null>, revalidate = 30): Promise<T> {
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate } });
  } catch {
    throw new ApiError("The catalogue is temporarily unavailable.", 0, "network");
  }
  if (!res.ok) throw new ApiError(res.status === 404 ? "Not found." : "The catalogue is temporarily unavailable.", res.status);
  return ((await res.json()) as { data: T }).data;
}

export const catalog = {
  movies: async (q: MovieQuery = {}) => (await publicGet<ApiMovie[]>("/movies", { per_page: 100, ...toQuery(q) })).map((m) => adaptMovie(m)),
  movie: async (slug: string): Promise<Movie | null> => {
    try {
      return adaptMovie(await publicGet<ApiMovie>(`/movies/${encodeURIComponent(slug)}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  genres: () => publicGet<{ slug: string; name: string }[]>("/genres", undefined, 300),
  cinemas: () => publicGet<ApiCinema[]>("/cinemas", undefined, 60),
};

/** Browser-side search used by interactive components (live filtering, search overlay). */
export async function searchMovies(q: MovieQuery, signal?: AbortSignal): Promise<Movie[]> {
  const res = await apiGet<ApiMovie[]>("/movies", { query: { per_page: 100, ...toQuery(q) }, signal, silent401: true });
  return res.data.map((m) => adaptMovie(m));
}

/** Browser-side, always fresh: showtimes and live seat state are never served from a cache. */
export async function fetchShowtimes(q: ShowtimeQuery, signal?: AbortSignal): Promise<ApiShowtime[]> {
  return (await apiGet<ApiShowtime[]>("/showtimes", { query: { per_page: 200, ...q }, signal, silent401: true })).data;
}

export async function fetchSeats(showtimeId: string, signal?: AbortSignal): Promise<{ bookable: boolean; seats: ApiSeat[] }> {
  return (await apiGet<{ bookable: boolean; seats: ApiSeat[] }>(`/showtimes/${encodeURIComponent(showtimeId)}/seats`, { signal, silent401: true })).data;
}

export async function fetchShowtime(showtimeId: string, signal?: AbortSignal): Promise<ApiShowtime | null> {
  try {
    return (await apiGet<ApiShowtime>(`/showtimes/${encodeURIComponent(showtimeId)}`, { signal, silent401: true })).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Server-component helper: the next showtime per movie for the home page cards. */
export async function nextShowtimesByMovie(): Promise<Record<string, ApiShowtime>> {
  const list = await publicGet<ApiShowtime[]>("/showtimes", { per_page: 200 }, 30);
  const out: Record<string, ApiShowtime> = {};
  for (const s of list) out[s.movie.slug] ??= s;
  return out;
}

export async function getShowtimeForPage(showtimeId: string): Promise<ApiShowtime | null> {
  try {
    return await publicGet<ApiShowtime>(`/showtimes/${encodeURIComponent(showtimeId)}`, undefined, 0);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
