import Link from "next/link";
import { Play, Ticket } from "lucide-react";
import type { Movie } from "@/types/movie";
import { Art } from "@/components/ui/art";
import { buttonClass } from "@/components/ui/button";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { formatDuration } from "@/lib/formatters";
import { routes } from "@/lib/routes";

export function FeaturedBanner({ movie }: { movie: Movie }) {
  return (
    <section className="on-dark relative isolate overflow-hidden bg-black" aria-labelledby="banner-heading">
      <div className="absolute inset-0 -z-10">
        <Art art={movie.art} seed={`${movie.slug}-banner`} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-black/75 lg:bg-black lg:[clip-path:polygon(46%_0,100%_0,100%_100%,26%_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden bg-accent lg:block lg:[clip-path:polygon(44%_0,46%_0,26%_100%,24%_100%)]"
      />
      <div className="container-page grid min-h-[34rem] items-center py-16 lg:grid-cols-2 lg:py-24">
        <div className="lg:col-start-2 lg:pl-10">
          <p className="eyebrow">Trending movie · Movie of the week</p>
          <h2 id="banner-heading" className="display mt-3 text-5xl sm:text-7xl">
            {movie.title}
          </h2>
          <p className="mt-4 max-w-lg text-white/85">{movie.synopsis}</p>
          <p className="mt-3 text-sm text-white/70">
            {movie.genres.join(" · ")} · {formatDuration(movie.durationMin)}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={routes.movie(movie.slug, "#showtimes")} className={buttonClass("primary", "lg")}>
              <Ticket className="size-5" aria-hidden /> Get Ticket
            </Link>
            <TrailerButton movie={movie} className={buttonClass("onDark", "lg")}>
              <Play className="size-5 fill-current" aria-hidden /> Play Trailer
            </TrailerButton>
          </div>
        </div>
      </div>
    </section>
  );
}
