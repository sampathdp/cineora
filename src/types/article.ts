import type { ArtSpec } from "./art";

export interface Article {
  slug: string;
  title: string;
  category: string;
  dayOffset: number;
  author: string;
  excerpt: string;
  body: string[];
  art: ArtSpec;
}

export interface Testimonial {
  id: string;
  name: string;
  title: string;
  quote: string;
  rating: number;
  initials: string;
  tone: string;
}
