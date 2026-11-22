"use client";

import { catalog, nextShowtimesByMovie } from "@/lib/api/catalog";
import { content } from "@/lib/api/content";
import { useClientData } from "@/lib/use-client-data";
import { Hero } from "@/components/home/hero";
import { TrailerStrip } from "@/components/home/trailer-strip";
import { Intro } from "@/components/home/intro";
import { NowPlaying } from "@/components/home/now-playing";
import { TopMovies } from "@/components/home/top-movies";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FeaturedBanner } from "@/components/home/featured-banner";
import { Partners } from "@/components/home/partners";
import { StatsStripe } from "@/components/home/stats-stripe";
import { CatalogUnavailable, Skeleton } from "@/components/ui/misc";

function loadHome() {
  return Promise.all([
    catalog.movies().catch(() => null),
    catalog.genres().catch(() => []),
    nextShowtimesByMovie().catch(() => ({})),
    content.testimonials().catch(() => []),
  ]);
}

function HomeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[80vh] min-h-[28rem] w-full rounded-none" />
    </div>
  );
}

export function HomeContent() {
  const { data, loading } = useClientData("home", loadHome);
  if (loading || !data) return <HomeLoading />;

  const [movies, genres, next, testimonials] = data;
  if (!movies || movies.length === 0) return <CatalogUnavailable empty={movies !== null} />;

  const nowPlaying = movies.filter((m) => m.status === "now-playing");
  const featured = movies.filter((m) => m.featured);
  const hero = featured.length ? featured : movies.slice(0, 3);
  const banner = movies.find((m) => m.slug === "wolf-season") ?? featured[0] ?? movies[0];
  const topRating = Math.max(...movies.map((m) => m.rating));
  const stats = [
    { value: String(nowPlaying.length), label: "Now playing" },
    { value: String(movies.length), label: "Movies listed" },
    { value: String(genres.length), label: "Genres" },
    ...(topRating > 0 ? [{ value: topRating.toFixed(1), label: "Top rating" }] : []),
    { value: "24/7", label: "Online booking" },
    { value: "QR", label: "Digital tickets" },
  ];

  return (
    <>
      <Hero movies={hero} />
      <StatsStripe stats={stats} />
      <NowPlaying movies={nowPlaying} genres={genres.map((g) => g.name)} />
      <TrailerStrip movies={movies.slice(0, 8)} />
      <Intro />
      <TopMovies movies={[...nowPlaying].sort((a, b) => b.rating - a.rating).slice(0, 6)} next={next} />
      <TestimonialsSection testimonials={testimonials} />
      <FeaturedBanner movie={banner} />
      <Partners />
    </>
  );
}
