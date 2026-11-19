import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/ui/section-heading";
import { MoviesGridLoading, MoviesPageContent } from "@/components/movies/movies-page";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse now playing and upcoming movies. Filter by genre, search and sort.",
  openGraph: { title: "Movies | CINEORA" },
};

export default function MoviesPage() {
  return (
    <>
      <PageHero eyebrow="Now & Next" title="Movies" description="Browse what's showing now and what's coming soon." />
      <section className="container-page py-10 lg:py-14">
        <Suspense fallback={<MoviesGridLoading />}>
          <MoviesPageContent />
        </Suspense>
      </section>
    </>
  );
}
