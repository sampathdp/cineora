import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieDetail } from "@/components/movies/movie-detail";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Movie" };

export default function MoviePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading movie" />}>
      <MovieDetail />
    </Suspense>
  );
}
