import type { Metadata } from "next";
import { Suspense } from "react";
import { catalog } from "@/lib/api/catalog";
import { PageHero } from "@/components/ui/section-heading";
import { MoviesExplorer } from "@/components/movies/movies-explorer";
import { CatalogUnavailable, Skeleton } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse now playing and upcoming movies. Filter by genre, search and sort.",
  openGraph: { title: "Movies | CINEORA" },
};

export default async function MoviesPage() {
  const [movies, genres] = await Promise.all([catalog.movies({ screening_status: "now_playing" }).catch(() => null), catalog.genres().catch(() => [])]);

  return (
    <>
      <PageHero eyebrow="Now & Next" title="Movies" description="Browse what's showing now and what's coming soon." />
      <section className="container-page py-10 lg:py-14">
        {movies === null ? (
          <CatalogUnavailable inline />
        ) : (
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[2/3]" />
                ))}
              </div>
            }
          >
            <MoviesExplorer initialMovies={movies} genres={genres} />
          </Suspense>
        )}
      </section>
    </>
  );
}
