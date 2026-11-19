"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Play, Star, Ticket } from "lucide-react";
import type { Movie } from "@/types/movie";
import { Art } from "@/components/ui/art";
import { buttonClass } from "@/components/ui/button";
import { TrailerButton } from "@/components/movies/trailer-modal";
import { formatDuration, releaseLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const INTERVAL_MS = 9000;
const arrowClass =
  "grid size-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:border-accent hover:bg-accent";

export function Hero({ movies }: { movies: Movie[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const movie = movies[index];

  function go(i: number) {
    setPaused(true);
    setIndex((i + movies.length) % movies.length);
  }

  useEffect(() => {
    if (paused || reduce) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % movies.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduce, movies.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured movies"
      className="on-dark relative isolate flex min-h-[100svh] items-end overflow-hidden bg-black pb-36 pt-32 sm:pb-44"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={movie.slug}
          className="absolute inset-0 -z-20"
          initial={reduce ? false : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: "easeOut" }}
        >
          <Art art={movie.art} seed={movie.slug} variant="backdrop" priority />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/55 to-black/40" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-transparent to-transparent" aria-hidden />

      <div className="container-page">
        <AnimatePresence mode="wait">
          <motion.div
            key={movie.slug}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
            aria-live={paused ? "polite" : "off"}
          >
            <p className="eyebrow">
              {movie.genres.join(" · ")} · <span suppressHydrationWarning>{releaseLabel(movie.releaseOffsetDays)}</span>
            </p>
            <h1 className="display mt-3 text-6xl text-white sm:text-8xl lg:text-[8.5rem]">{movie.title}</h1>
            <p className="mt-5 max-w-xl text-pretty text-base text-white/85 sm:text-lg">{movie.synopsis}</p>
            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
              <li className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-accent" aria-hidden /> {formatDuration(movie.durationMin)}
              </li>
              {movie.rating > 0 ? (
                <li className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-accent text-accent" aria-hidden /> {movie.rating.toFixed(1)}
                </li>
              ) : null}
              <li className="rounded border border-white/40 px-1.5 py-0.5 text-xs font-bold">{movie.certificate}</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={routes.movie(movie.slug, "#showtimes")} className={buttonClass("primary", "lg")}>
                <Ticket className="size-5" aria-hidden /> Book Tickets
              </Link>
              <TrailerButton movie={movie} className={buttonClass("onDark", "lg")}>
                <Play className="size-5 fill-current" aria-hidden /> Watch Trailer
              </TrailerButton>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous movie" onClick={() => go(index - 1)} className={arrowClass}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Next movie" onClick={() => go(index + 1)} className={arrowClass}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <span className="ml-2 text-sm tabular-nums text-white/70" aria-hidden>
              <strong className="text-white">0{index + 1}</strong> / 0{movies.length}
            </span>
          </div>

          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Choose featured movie">
            {movies.map((m, i) => {
              const active = i === index;
              return (
                <button
                  key={m.slug}
                  type="button"
                  aria-label={`Show ${m.title}`}
                  aria-current={active}
                  onClick={() => go(i)}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border p-2 pr-4 text-left backdrop-blur-md transition",
                    active ? "border-accent/70 bg-white/15" : "border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10",
                  )}
                >
                  <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-lg">
                    <Art art={m.art} seed={m.slug} />
                  </span>
                  <span className="hidden min-w-0 max-w-32 sm:block">
                    <span className={cn("block truncate text-sm font-semibold", active ? "text-white" : "text-white/75")}>{m.title}</span>
                    <span className="block truncate text-xs text-white/55">{m.genres[0]}</span>
                  </span>
                  {active ? (
                    <motion.span
                      key={`${m.slug}-${index}-${paused}`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent"
                      initial={{ scaleX: paused || reduce ? 1 : 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: paused || reduce ? 0 : INTERVAL_MS / 1000, ease: "linear" }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
