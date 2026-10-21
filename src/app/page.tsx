import { featuredMovies, movies, nowPlaying, getMovie } from "@/data/movies";
import { Hero } from "@/components/home/hero";
import { TrailerStrip } from "@/components/home/trailer-strip";
import { Intro } from "@/components/home/intro";
import { NowPlaying } from "@/components/home/now-playing";
import { TopMovies } from "@/components/home/top-movies";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FeaturedBanner } from "@/components/home/featured-banner";
import { Partners } from "@/components/home/partners";

export default function HomePage() {
  const banner = getMovie("wolf-season") ?? movies[0];
  return (
    <>
      <Hero movies={featuredMovies} />
      <TrailerStrip movies={movies.slice(0, 8)} />
      <Intro />
      <NowPlaying />
      <TopMovies movies={[...nowPlaying].sort((a, b) => b.rating - a.rating).slice(0, 6)} />
      <TestimonialsSection />
      <FeaturedBanner movie={banner} />
      <Partners />
    </>
  );
}
