"use client";

import Link from "next/link";
import { useRef } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import type { Movie } from "@/types/movie";
import type { ApiShowtime } from "@/lib/api/catalog";
import { Art } from "@/components/ui/art";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonClass } from "@/components/ui/button";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { formatDuration, formatISODate, formatTime, zonedParts } from "@/lib/formatters";
import { routes } from "@/lib/routes";

export function TopMovies({ movies, next }: { movies: Movie[]; next: Record<string, ApiShowtime> }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: "smooth" });

  return (
    <section className="section-y" aria-labelledby="top-movies-heading">
      <div className="container-page">
        <SectionHeading
          align="left"
          eyebrow="Showing this week"
          title={<span id="top-movies-heading">Top Movies in Theater</span>}
          action={
            <div className="flex gap-2">
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => scroll(d)}
                  aria-label={d === -1 ? "Previous movies" : "Next movies"}
                  className="grid size-11 place-items-center rounded-full border border-line bg-elevated transition hover:border-accent hover:bg-accent hover:text-on-accent"
                >
                  {d === -1 ? <ChevronLeft className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
                </button>
              ))}
            </div>
          }
        />
      </div>
      <div className="container-page">
        <ul
          ref={ref}
          className="scrollbar-none -mx-1 mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-6 pt-1"
        >
          {movies.map((m, i) => {
            const upcoming = next[m.slug];
            const when = upcoming ? zonedParts(upcoming.starts_at, upcoming.cinema.timezone) : null;
            return (
              <li key={m.slug} className="flex w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]">
                <article className="group flex w-full flex-col overflow-hidden rounded-card border border-line bg-elevated shadow-card transition hover:-translate-y-1 hover:border-accent/60">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <div className="size-full transition duration-700 group-hover:scale-105">
                      <Art art={m.art} seed={`${m.slug}-wide`} variant="backdrop" />
                    </div>
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                    <span className="display absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-sm text-on-accent">#{i + 1}</span>
                    {m.rating > 0 ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur">
                        <Star className="size-3.5 fill-accent text-accent" aria-hidden />
                        {m.rating.toFixed(1)}
                        <span className="sr-only"> out of 10</span>
                      </span>
                    ) : null}
                    <TrailerButton
                      movie={m}
                      className="absolute inset-0 grid place-items-center"
                      aria-label={`Play ${m.title} trailer`}
                    >
                      <span className="grid size-14 scale-90 place-items-center rounded-full bg-white/90 text-black opacity-90 transition group-hover:scale-100 group-hover:bg-accent group-hover:text-on-accent group-hover:opacity-100">
                        <Play className="size-6 translate-x-0.5 fill-current" aria-hidden />
                      </span>
                    </TrailerButton>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wider text-accent-text">
                      <span>{m.genres.join(" · ")}</span>
                      {m.certificate ? <span className="rounded border border-line px-1.5 py-0.5 text-muted">{m.certificate}</span> : null}
                      {m.durationMin > 0 ? <span className="text-muted">{formatDuration(m.durationMin)}</span> : null}
                    </p>
                    <h3 className="display mt-2 line-clamp-2 text-2xl sm:text-3xl">
                      <Link href={routes.movie(m.slug)} className="hover:text-accent-text">
                        {m.title}
                      </Link>
                    </h3>
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                      <CalendarClock className="size-4 shrink-0 text-accent-text" aria-hidden />
                      {upcoming && when ? (
                        <span className="truncate">
                          {formatISODate(when.date, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(when.time)} · {upcoming.cinema.name}
                        </span>
                      ) : (
                        <span>Showtimes announced soon</span>
                      )}
                    </p>
                    <div className="mt-auto flex items-center gap-3 pt-5">
                      <Link href={routes.movie(m.slug, "#showtimes")} className={buttonClass("primary", "sm")}>
                        Get Tickets
                      </Link>
                      <Link href={routes.movie(m.slug)} className="text-sm font-semibold text-muted transition hover:text-accent-text">
                        Details
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
