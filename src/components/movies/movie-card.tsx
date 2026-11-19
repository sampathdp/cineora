import Link from "next/link";
import { Clock, Play, Star } from "lucide-react";
import type { Movie } from "@/types/movie";
import { Art } from "@/components/ui/art";
import { Badge } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { formatDuration, releaseLabel } from "@/lib/formatters";
import { TrailerButton } from "./trailer-modal";
import { routes } from "@/lib/routes";

export function MovieCard({ movie }: { movie: Movie }) {
  const playing = movie.status === "now-playing";
  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <Link href={routes.movie(movie.slug)} className="relative block aspect-[2/3] overflow-hidden" aria-label={`${movie.title} details`}>
          <div className="size-full transition duration-700 ease-out group-hover:scale-110 group-focus-within:scale-110">
            <Art art={movie.art} seed={movie.slug} title={movie.title} variant="poster" />
          </div>
          <div className="absolute inset-0 flex translate-y-4 flex-col justify-end gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <p className="line-clamp-4 text-sm text-white/90">{movie.synopsis}</p>
          </div>
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <Badge tone={playing ? "accent" : "dark"}>
            <span suppressHydrationWarning>{releaseLabel(movie.releaseOffsetDays)}</span>
          </Badge>
        </div>
        {movie.rating > 0 ? (
          <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-sm bg-black/65 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
            <Star className="size-3 fill-accent text-accent" aria-hidden /> {movie.rating.toFixed(1)}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5">
        <h3 className="display text-2xl">
          <Link href={routes.movie(movie.slug)} className="hover:text-accent-text">
            {movie.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{movie.genres.join(", ")}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatDuration(movie.durationMin)}
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          {playing ? (
            <Link href={routes.movie(movie.slug, "#showtimes")} className={buttonClass("primary", "sm", "flex-1")}>
              Get Tickets
            </Link>
          ) : (
            <Link href={routes.movie(movie.slug)} className={buttonClass("secondary", "sm", "flex-1")}>
              View Details
            </Link>
          )}
          <TrailerButton
            movie={movie}
            className="grid size-9 shrink-0 place-items-center rounded-control border border-line transition hover:border-accent hover:text-accent-text"
          >
            <Play className="size-4 fill-current" aria-hidden />
          </TrailerButton>
        </div>
      </div>
    </article>
  );
}
