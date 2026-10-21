"use client";

import { useState } from "react";
import { Clock, Play } from "lucide-react";
import type { Movie } from "@/types/movie";
import { Art } from "@/components/ui/art";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** Featured trailer player card with a playlist to pick from. */
export function TrailerStrip({ movies }: { movies: Movie[] }) {
  const [index, setIndex] = useState(0);
  const movie = movies[index];

  return (
    <section aria-labelledby="trailers-heading" className="section-y relative">
      <div className="container-page">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Watch now</p>
            <h2 id="trailers-heading" className="display mt-2 text-4xl sm:text-5xl">
              Latest trailers
            </h2>
          </div>
          <p className="text-sm text-muted">
            <strong className="text-foreground">{index + 1}</strong> / {movies.length}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <TrailerButton
            movie={movie}
            className="on-dark group relative block aspect-video w-full overflow-hidden rounded-3xl border border-line text-left shadow-card"
          >
            <div key={movie.slug} className="size-full animate-[fadeIn_0.5s_ease-out] transition duration-700 group-hover:scale-105">
              <Art art={movie.art} seed={`${movie.slug}-trailer`} variant="backdrop" />
            </div>
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" aria-hidden />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-20 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_0_10px_rgba(255,255,255,0.15)] transition duration-300 group-hover:scale-110 group-hover:shadow-[0_0_0_16px_rgba(255,255,255,0.2)]">
                <Play className="size-8 translate-x-0.5 fill-current" aria-hidden />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <span className="eyebrow block">{movie.genres.join(" · ")}</span>
              <span className="display mt-1 block text-3xl text-white sm:text-5xl">{movie.title}</span>
              <span className="mt-1 block max-w-lg truncate text-sm text-white/75">{movie.tagline}</span>
            </span>
          </TrailerButton>

          <ul
            aria-label="Trailer playlist"
            className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:max-h-[26rem] lg:flex-col lg:overflow-y-auto lg:px-0 lg:pr-1"
          >
            {movies.map((m, i) => {
              const active = i === index;
              return (
                <li key={m.slug} className="w-64 shrink-0 lg:w-auto">
                  <button
                    type="button"
                    aria-current={active}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                      active ? "border-accent bg-accent/10" : "border-line bg-elevated hover:border-accent/60",
                    )}
                  >
                    <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl">
                      <Art art={m.art} seed={`${m.slug}-trailer`} variant="backdrop" />
                      <span className="absolute inset-0 grid place-items-center bg-black/30">
                        <Play className="size-5 fill-white text-white" aria-hidden />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block truncate font-semibold", active && "text-accent-text")}>{m.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <Clock className="size-3" aria-hidden /> {formatDuration(m.durationMin)} · {m.genres[0]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
