"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Movie, MovieStatus } from "@/types/movie";
import type { MovieQuery } from "@/lib/api/catalog";
import { useMovieSearch } from "@/lib/api/use-movie-search";
import { MovieCard } from "./movie-card";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;
type Sort = "popular" | "rating" | "title" | "duration";
type GenreOption = { slug: string; name: string };

const chip = (active: boolean) =>
  cn(
    "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
    active ? "border-accent bg-accent text-on-accent" : "border-line bg-elevated hover:border-accent",
  );

const apiSort: Partial<Record<Sort, MovieQuery["sort"]>> = { rating: "-rating", title: "title" };

/** Filtering, search and sorting are done by the API; this component only holds the form state. */
export function MoviesExplorer({ initialMovies, genres }: { initialMovies: Movie[]; genres: GenreOption[] }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<MovieStatus>(params.get("tab") === "coming-soon" ? "coming-soon" : "now-playing");
  const [genre, setGenre] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const request: MovieQuery = {
    screening_status: tab === "now-playing" ? "now_playing" : "coming_soon",
    genre: genre === "all" ? undefined : genre,
    q: query.trim() || undefined,
    sort: apiSort[sort],
  };
  // The server pre-loads the default view (Now Playing, no filters) so the first paint needs no request.
  const isDefaultView = tab === "now-playing" && genre === "all" && !query.trim() && sort === "popular";
  const { movies, loading, error, retry } = useMovieSearch(request, { initial: isDefaultView ? initialMovies : undefined });

  const list = useMemo(() => {
    if (!movies) return null;
    return sort === "duration" ? [...movies].sort((a, b) => a.durationMin - b.durationMin) : movies;
  }, [movies, sort]);

  const reset = () => {
    setQuery("");
    setGenre("all");
    setVisible(PAGE_SIZE);
  };
  const shown = list?.slice(0, visible) ?? [];

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
              maxLength={100}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search by title"
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
              <option value="popular">Newest</option>
              <option value="title">Title A–Z</option>
              <option value="duration">Shortest first</option>
            </select>
          </div>
        </div>

        <div role="group" aria-label="Filter by genre" className="flex flex-wrap gap-2">
          {[{ slug: "all", name: "All" }, ...genres].map((g) => (
            <button
              key={g.slug}
              type="button"
              aria-pressed={genre === g.slug}
              onClick={() => {
                setGenre(g.slug);
                setVisible(PAGE_SIZE);
              }}
              className={chip(genre === g.slug)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted" role="status">
        {error ? "" : list ? `${list.length} ${list.length === 1 ? "movie" : "movies"}` : "Loading…"}
      </p>

      {error ? (
        <div className="mt-4">
          <EmptyState
            title="Could not load movies"
            description={error}
            action={
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            }
          />
        </div>
      ) : list === null || (loading && list.length === 0) ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[2/3]" />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
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
        <ul className={cn("mt-4 grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6", loading && "opacity-60")}>
          {shown.map((m) => (
            <li key={m.slug}>
              <MovieCard movie={m} />
            </li>
          ))}
        </ul>
      )}

      {list && list.length > visible ? (
        <div className="mt-12 flex justify-center">
          <Button variant="secondary" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
