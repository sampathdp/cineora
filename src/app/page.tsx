import { catalog, nextShowtimesByMovie } from "@/lib/api/catalog";
import { content } from "@/lib/api/content";
import { Hero } from "@/components/home/hero";
import { TrailerStrip } from "@/components/home/trailer-strip";
import { Intro } from "@/components/home/intro";
import { NowPlaying } from "@/components/home/now-playing";
import { TopMovies } from "@/components/home/top-movies";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FeaturedBanner } from "@/components/home/featured-banner";
import { Partners } from "@/components/home/partners";
import { CatalogUnavailable } from "@/components/ui/misc";

// Catalogue data comes from the API at request time (short data-cache), so the build does not need the API.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [movies, genres, next, testimonials] = await Promise.all([
    catalog.movies().catch(() => null),
    catalog.genres().catch(() => []),
    nextShowtimesByMovie().catch(() => ({})),
    content.testimonials().catch(() => []),
  ]);

  if (!movies || movies.length === 0) {
    return <CatalogUnavailable empty={movies !== null} />;
  }

  const nowPlaying = movies.filter((m) => m.status === "now-playing");
  const featured = movies.filter((m) => m.featured);
  const hero = featured.length ? featured : movies.slice(0, 3);
  const banner = movies.find((m) => m.slug === "wolf-season") ?? featured[0] ?? movies[0];

  return (
    <>
      <Hero movies={hero} />
      <TrailerStrip movies={movies.slice(0, 8)} />
      <Intro />
      <NowPlaying movies={nowPlaying} genres={genres.map((g) => g.name)} />
      <TopMovies movies={[...nowPlaying].sort((a, b) => b.rating - a.rating).slice(0, 6)} next={next} />
      <TestimonialsSection testimonials={testimonials} />
      <FeaturedBanner movie={banner} />
      <Partners />
    </>
  );
}
