"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { Movie } from "@/types/movie";
import type { ApiShowtime } from "@/lib/api/catalog";
import { Art } from "@/components/ui/art";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonClass } from "@/components/ui/button";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";
import { routes } from "@/lib/routes";

export function TopMovies({ movies, next }: { movies: Movie[]; next: Record<string, ApiShowtime> }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });

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
      <ul ref={ref} className="scrollbar-none mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        {movies.map((m) => {
          const upcoming = next[m.slug];
          const when = upcoming ? zonedParts(upcoming.starts_at, upcoming.cinema.timezone) : null;
          return (
            <li key={m.slug} className="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
              <article className="group overflow-hidden rounded-card border border-line bg-elevated shadow-card">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <div className="size-full transition duration-700 group-hover:scale-105">
                    <Art art={m.art} seed={`${m.slug}-wide`} variant="backdrop" />
                  </div>
                  <TrailerButton movie={m} className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/40" aria-label={`Play ${m.title} trailer`}>
                    <span className="grid size-14 place-items-center rounded-full bg-white/90 text-black transition group-hover:bg-accent group-hover:text-on-accent">
                      <Play className="size-6 translate-x-0.5 fill-current" aria-hidden />
                    </span>
                  </TrailerButton>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">{m.genres.join(" · ")}</p>
                  <h3 className="display mt-1 text-2xl sm:text-3xl">
                    <Link href={routes.movie(m.slug)} className="hover:text-accent-text">
                      {m.title}
                    </Link>
                  </h3>
                  {upcoming && when ? (
                    <p className="mt-1 text-sm text-muted">
                      Next: {formatISODate(when.date, { weekday: "short", day: "numeric", month: "short" })} {formatTime(when.time)} · {upcoming.cinema.name}
                    </p>
                  ) : null}
                  <Link href={routes.movie(m.slug, "#showtimes")} className={buttonClass("primary", "sm", "mt-4")}>
                    Get Tickets
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
