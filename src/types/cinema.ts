import type { ArtSpec } from "./art";

export type ScreenType = "Standard" | "Premium Large Format" | "Lounge";

export interface Screen {
  id: string;
  name: string;
  type: ScreenType;
  rows: number;
  seatsPerRow: number;
  priceMultiplier: number;
}

export interface Cinema {
  slug: string;
  name: string;
  area: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  facilities: string[];
  screens: Screen[];
  art: ArtSpec;
}

export interface Showtime {
  id: string;
  movieSlug: string;
  cinemaSlug: string;
  screenId: string;
  /** Days from today. */
  dayOffset: number;
  /** 24h "HH:MM". */
  time: string;
}
