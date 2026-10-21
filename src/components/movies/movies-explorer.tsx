"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { movies, genres } from "@/data/movies";
import type { MovieStatus } from "@/types/movie";
import { MovieCard } from "./movie-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;
type Sort = "popular" | "rating" | "title" | "duration";

const chip = (active: boolean) =>
  cn(
    "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
    active ? "border-accent bg-accent text-on-accent" : "border-line bg-elevated hover:border-accent",
  );

export function MoviesExplorer() {
  const params = useSearchParams();
  const [tab, setTab] = useState<MovieStatus>(params.get("tab") === "coming-soon" ? "coming-soon" : "now-playing");
  const [genre, setGenre] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = movies.filter(
      (m) =>
        m.status === tab &&
        (genre === "All" || m.genres.includes(genre as never)) &&
        (!q || `${m.title} ${m.genres.join(" ")} ${m.director}`.toLowerCase().includes(q)),
    );
    const sorters: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      popular: () => 0,
      rating: (a, b) => b.rating - a.rating,
      title: (a, b) => a.title.localeCompare(b.title),
      duration: (a, b) => a.durationMin - b.durationMin,
    };
    return [...list].sort(sorters[sort]);
  }, [tab, genre, query, sort]);

  const reset = () => {
    setQuery("");
    setGenre("All");
    setVisible(PAGE_SIZE);
  };
  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="flex flex-col gap-5">
        <div role="tablist" aria-label="Movie status" className="inline-flex w-fit rounded-full border border-line bg-elevated p-1">
          {(["now-playing", "coming-soon"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "min-h-10 rounded-full px-5 text-sm font-semibold transition",
                tab === t ? "bg-accent text-on-accent" : "text-muted hover:text-foreground",
              )}
            >
              {t === "now-playing" ? "Now Playing" : "Coming Soon"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <label htmlFor="movie-search" className="sr-only">
              Search movies
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="movie-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search title, genre or director"
              className="h-11 w-full rounded-control border border-line bg-elevated pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="movie-sort" className="text-sm text-muted">
              Sort by
            </label>
            <select
              id="movie-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 rounded-control border border-line bg-elevated px-3 text-sm outline-none focus:border-accent"
            >
              <option value="popular">Featured</option>
              <option value="rating">Top rated</option>
              <option value="title">Title A–Z</option>
              <option value="duration">Shortest first</option>
            </select>
          </div>
        </div>

        <div role="group" aria-label="Filter by genre" className="flex flex-wrap gap-2">
          {["All", ...genres].map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={genre === g}
              onClick={() => {
                setGenre(g);
                setVisible(PAGE_SIZE);
              }}
              className={chip(genre === g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted" role="status">
        {filtered.length} {filtered.length === 1 ? "movie" : "movies"}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No movies match"
            description="Try a different genre, tab or search term."
            action={
              <Button variant="secondary" onClick={reset}>
                <X className="size-4" aria-hidden /> Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {shown.map((m) => (
            <li key={m.slug}>
              <MovieCard movie={m} />
            </li>
          ))}
        </ul>
      )}

      {filtered.length > visible ? (
        <div className="mt-12 flex justify-center">
          <Button variant="secondary" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
