"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Clock, Play, Star, Ticket } from "lucide-react";
import { catalog } from "@/lib/api/catalog";
import { useClientData } from "@/lib/use-client-data";
import { Art } from "@/components/ui/art";
import { Badge, BackLink, CatalogUnavailable, PageLoading } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { ShowtimeBrowser } from "@/components/movies/showtime-browser";
import { formatDuration, formatOffsetDate, releaseLabel } from "@/lib/formatters";
import NotFound from "@/app/not-found";

export function MovieDetail() {
  const slug = useSearchParams().get("slug");
  const { data: movie, error, loading } = useClientData(slug ? `movie:${slug}` : null, () => catalog.movie(slug!));

  // The page renders after the data arrives, so the browser's own jump to #showtimes happened too early.
  useEffect(() => {
    if (movie && window.location.hash === "#showtimes") document.getElementById("showtimes")?.scrollIntoView();
  }, [movie]);

  if (!slug) return <NotFound />;
  if (loading) return <PageLoading label="Loading movie" />;
  if (error) return <CatalogUnavailable />;
  if (!movie) return <NotFound />;

  const playing = movie.status === "now-playing";

  return (
    <>
      <title>{`${movie.title} | AR ENTERTAINMENT`}</title>
      <meta name="description" content={movie.synopsis} />
      <section className="on-dark relative isolate overflow-hidden bg-black pt-28 pb-12 sm:pt-36 sm:pb-16">
        <div className="absolute inset-0 -z-10 opacity-70">
          <Art art={movie.art} seed={`${movie.slug}-hero`} variant="backdrop" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/60 to-black/30" aria-hidden />
        <div className="container-page grid grid-cols-1 items-end gap-8 md:grid-cols-[minmax(0,16rem)_1fr] lg:grid-cols-[18rem_1fr] lg:gap-12">
          <div className="mx-auto w-full max-w-[16rem] overflow-hidden rounded-card border border-white/20 shadow-2xl md:mx-0">
            <div className="aspect-[2/3]">
              <Art art={movie.art} seed={movie.slug} title={movie.title} label={`${movie.title} poster artwork`} />
            </div>
          </div>
          <div>
            <BackLink href="/movies">All movies</BackLink>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={playing ? "accent" : "dark"}>{releaseLabel(movie.releaseOffsetDays)}</Badge>
              <Badge tone="dark">{movie.certificate}</Badge>
              {movie.genres.map((g) => (
                <Badge key={g} tone="dark">
                  {g}
                </Badge>
              ))}
            </div>
            <h1 className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">{movie.title}</h1>
            <p className="mt-3 text-lg italic text-white/80">{movie.tagline}</p>
            <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
              <li className="inline-flex items-center gap-2">
                <Clock className="size-4 text-accent" aria-hidden /> {formatDuration(movie.durationMin)}
              </li>
              {movie.rating > 0 ? (
                <li className="inline-flex items-center gap-2">
                  <Star className="size-4 fill-accent text-accent" aria-hidden /> {movie.rating.toFixed(1)} / 10
                </li>
              ) : null}
              <li className="inline-flex items-center gap-2">
                <Calendar className="size-4 text-accent" aria-hidden />{" "}
                {formatOffsetDate(movie.releaseOffsetDays, { day: "numeric", month: "long", year: "numeric" })}
              </li>
            </ul>
            <p className="mt-5 max-w-2xl text-pretty text-white/85">{movie.synopsis}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {playing ? (
                <a href="#showtimes" className={buttonClass("primary", "lg")}>
                  <Ticket className="size-5" aria-hidden /> Book Tickets
                </a>
              ) : null}
              <TrailerButton movie={movie} className={buttonClass("onDark", "lg")}>
                <Play className="size-5 fill-current" aria-hidden /> Watch Trailer
              </TrailerButton>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page flex flex-col gap-14 py-14 lg:py-20">
        <div className="min-w-0">
          <h2 className="display text-3xl sm:text-4xl" id="showtimes">
            Showtimes
          </h2>
          <div className="mt-6 scroll-mt-28">
            {playing ? (
              <ShowtimeBrowser slug={movie.slug} />
            ) : (
              <p className="rounded-card border border-dashed border-line p-8 text-center text-muted">
                Tickets are not on sale yet for this title. It opens{" "}
                {formatOffsetDate(movie.releaseOffsetDays, { day: "numeric", month: "long" })}.
              </p>
            )}
          </div>
        </div>

        <aside>
          <div>
            <h2 className="display text-2xl">Cast &amp; Crew</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex justify-between gap-4 rounded-2xl border border-line bg-elevated p-4">
                <dt className="text-muted">Director</dt>
                <dd className="text-right font-semibold">{movie.director}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-line bg-elevated p-4">
                <dt className="text-muted">Writers</dt>
                <dd className="text-right font-semibold">{movie.writers.join(", ")}</dd>
              </div>
              {movie.cast.map((c) => (
                <div key={c.name} className="flex justify-between gap-4 rounded-2xl border border-line bg-elevated p-4">
                  <dt className="text-muted">{c.role}</dt>
                  <dd className="text-right font-semibold">{c.name}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </section>
    </>
  );
}
