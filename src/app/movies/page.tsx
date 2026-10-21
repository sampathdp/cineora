import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/ui/section-heading";
import { MoviesExplorer } from "@/components/movies/movies-explorer";
import { Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse now playing and upcoming demo movies. Filter by genre, search and sort.",
  openGraph: { title: "Movies | CINEORA" },
};

export default function MoviesPage() {
  return (
    <>
      <PageHero eyebrow="Now & Next" title="Movies" description="Browse what's showing now and what's coming soon. All titles are fictional demo content." />
      <section className="container-page py-10 lg:py-14">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-[2/3]" />
              ))}
            </div>
          }
        >
          <MoviesExplorer />
        </Suspense>
      </section>
    </>
  );
}
