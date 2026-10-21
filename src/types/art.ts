export type ArtMotif =
  | "moon"
  | "mountains"
  | "city"
  | "sun"
  | "stars"
  | "waves"
  | "forest"
  | "door"
  | "eye";

export interface ArtSpec {
  from: string;
  to: string;
  accent: string;
  motif: ArtMotif;
  image?: string;
  backdrop?: string;
}
