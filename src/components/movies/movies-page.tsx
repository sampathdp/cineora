"use client";

import { catalog } from "@/lib/api/catalog";
import { useClientData } from "@/lib/use-client-data";
import { MoviesExplorer } from "@/components/movies/movies-explorer";
import { CatalogUnavailable, Skeleton } from "@/components/ui/misc";

function load() {
  return Promise.all([catalog.movies({ screening_status: "now_playing" }).catch(() => null), catalog.genres().catch(() => [])]);
}

export function MoviesGridLoading() {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-[2/3]" />
      ))}
    </div>
  );
}

export function MoviesPageContent() {
  const { data, loading } = useClientData("movies-page", load);
  if (loading || !data) return <MoviesGridLoading />;
  const [movies, genres] = data;
  if (movies === null) return <CatalogUnavailable inline />;
  return <MoviesExplorer initialMovies={movies} genres={genres} />;
}
