import type { ArtSpec } from "./art";

export type Genre =
  | "Action"
  | "Drama"
  | "Comedy"
  | "Animation"
  | "Thriller"
  | "Adventure"
  | "Mystery"
  | "Romance"
  | "Sci-Fi"
  | "Family";

export type MovieStatus = "now-playing" | "coming-soon";

export interface CastMember {
  name: string;
  role: string;
}

export interface Movie {
  slug: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: Genre[];
  durationMin: number;
  /** 0–10, illustrative demo value. */
  rating: number;
  certificate: string;
  status: MovieStatus;
  /** Days relative to today; negative = already released. */
  releaseOffsetDays: number;
  director: string;
  writers: string[];
  cast: CastMember[];
  /** Full YouTube watch/embed URL. Leave undefined to show the preview state. */
  trailerUrl?: string;
  art: ArtSpec;
  featured?: boolean;
}
