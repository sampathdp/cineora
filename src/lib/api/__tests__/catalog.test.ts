import { describe, expect, it } from "vitest";
import { adaptMovie, type ApiMovie } from "../catalog";

const base: ApiMovie = {
  id: "01ABC",
  slug: "ashes",
  title: "Ashes",
  tagline: null,
  description: "Plot",
  duration_min: 118,
  release_date: "2026-11-01",
  age_rating: "PG-13",
  rating: 7.8,
  screening_status: "now_playing",
  is_featured: true,
  poster_url: "http://api/storage/p.jpg",
  banner_url: null,
  trailer_url: null,
  art_theme: null,
  genres: [{ slug: "thriller", name: "Thriller" }],
  cast: [{ name: "A", role: "Hero" }],
  crew: [
    { name: "Dir", job: "director" },
    { name: "W1", job: "writer" },
    { name: "W2", job: "writer" },
  ],
};

describe("adaptMovie", () => {
  const now = Date.parse("2026-11-08T10:00:00Z");

  it("maps API fields onto the UI movie shape", () => {
    const m = adaptMovie(base, now);
    expect(m).toMatchObject({
      slug: "ashes",
      synopsis: "Plot",
      tagline: "",
      durationMin: 118,
      certificate: "PG-13",
      status: "now-playing",
      director: "Dir",
      writers: ["W1", "W2"],
      genres: ["Thriller"],
      featured: true,
    });
    expect(m.cast).toEqual([{ name: "A", role: "Hero" }]);
  });

  it("computes the release offset in whole days relative to today", () => {
    expect(adaptMovie(base, now).releaseOffsetDays).toBe(-7);
    expect(adaptMovie({ ...base, release_date: "2026-11-15" }, now).releaseOffsetDays).toBe(7);
    expect(adaptMovie({ ...base, release_date: "2026-11-08" }, now).releaseOffsetDays).toBe(0);
  });

  it("falls back to neutral artwork and leaves the backdrop empty when there is no banner", () => {
    const m = adaptMovie(base, now);
    expect(m.art.image).toBe("http://api/storage/p.jpg");
    // Wide slots then render the poster uncropped over a blurred copy instead of stretching it.
    expect(m.art.backdrop).toBeUndefined();
    expect(m.art.motif).toBe("stars");
    const themed = adaptMovie({ ...base, art_theme: { from: "#111111", to: "#000000", accent: "#ff0000", motif: "moon" } }, now);
    expect(themed.art).toMatchObject({ from: "#111111", motif: "moon" });
  });

  it("maps coming soon and missing optional values", () => {
    const m = adaptMovie({ ...base, screening_status: "coming_soon", rating: null, age_rating: null, crew: undefined, cast: undefined, genres: undefined }, now);
    expect(m.status).toBe("coming-soon");
    expect(m.rating).toBe(0);
    expect(m.certificate).toBe("NR");
    expect(m.director).toBe("");
    expect(m.genres).toEqual([]);
  });
});
