"use client";

import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import type { Movie } from "@/types/movie";
import { Modal } from "@/components/ui/modal";
import { Art } from "@/components/ui/art";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Returns a privacy-friendly embed URL for valid YouTube links, otherwise null. */
export function toYouTubeEmbed(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
    }
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
  } catch {
    return null;
  }
}

export function TrailerModal({ movie, open, onClose }: { movie: Movie; open: boolean; onClose: () => void }) {
  const embed = toYouTubeEmbed(movie.trailerUrl);
  return (
    <Modal open={open} onClose={onClose} title={`${movie.title} — Trailer`} className="max-w-4xl">
      <div className="px-5 pb-5 pt-4">
        <div className="mt-8 aspect-video overflow-hidden rounded-card bg-black">
          {embed ? (
            <iframe
              src={embed}
              title={`${movie.title} trailer`}
              className="size-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="relative size-full">
              <Art art={movie.art} seed={movie.slug} label={`${movie.title} preview artwork`} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 p-6 text-center text-white">
                <span className="grid size-16 place-items-center rounded-full bg-accent/90 text-on-accent">
                  <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
                </span>
                <p className="display text-2xl sm:text-3xl">Trailer coming soon</p>
                <p className="max-w-sm text-sm text-white/80">
                  No trailer URL is configured for this demo title. Add a YouTube link to <code>trailerUrl</code> in the
                  movie data to enable playback.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{movie.tagline}</p>
          {movie.status === "now-playing" ? (
            <LinkButton href={`/movies/${movie.slug}#showtimes`} size="sm">
              Book Tickets
            </LinkButton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/** Button that opens the trailer dialog for a movie. */
export function TrailerButton({
  movie,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  movie: Movie;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("cursor-pointer", className)}
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? `Watch ${movie.title} trailer`}
      >
        {children}
      </button>
      <TrailerModal movie={movie} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
