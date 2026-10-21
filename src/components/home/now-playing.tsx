"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { genres, nowPlaying } from "@/data/movies";
import { MovieCard } from "@/components/movies/movie-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NowPlaying() {
  const [genre, setGenre] = useState<string>("All");
  const list = nowPlaying.filter((m) => genre === "All" || m.genres.includes(genre as never)).slice(0, 8);

  return (
    <section className="section-y bg-surface" aria-labelledby="now-playing-heading">
      <div className="container-page">
        <SectionHeading eyebrow="Watch new movies" title={<span id="now-playing-heading">Movie Now Playing</span>} />
        <div role="group" aria-label="Filter by genre" className="mt-8 flex flex-wrap justify-center gap-2">
          {["All", ...genres].map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={genre === g}
              onClick={() => setGenre(g)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
                genre === g ? "border-accent bg-accent text-on-accent" : "border-line bg-elevated hover:border-accent",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="mt-10">
          {list.length === 0 ? (
            <EmptyState title="Nothing in this genre right now" description="Try another genre." />
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
              {list.map((m) => (
                <li key={m.slug}>
                  <MovieCard movie={m} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-12 flex justify-center">
          <Link href="/movies" className={buttonClass("secondary", "lg")}>
            View All Movies <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
