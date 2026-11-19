"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Film, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useMovieSearch } from "@/lib/api/use-movie-search";

interface Result {
  key: string;
  href: string;
  title: string;
  meta: string;
  kind: "Movie";
}

const icons = { Movie: Film } as const;

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Search" hideTitle align="top" className="max-w-2xl">
      <SearchBody onClose={onClose} />
    </Modal>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const { movies, loading, error } = useMovieSearch({ q: deferred || undefined, per_page: 12 }, { enabled: deferred.length > 0 });

  const results: Result[] = useMemo(
    () =>
      deferred && movies
        ? movies.map((m) => ({ key: `m-${m.slug}`, href: `/movies/${m.slug}`, title: m.title, meta: m.genres.join(" · "), kind: "Movie" as const }))
        : [],
    [deferred, movies],
  );

  return (
    <div className="p-4 pt-5 sm:p-6">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mr-12">
        <label htmlFor="site-search" className="sr-only">
          Search movies
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="site-search"
          data-autofocus
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies…"
          className="h-12 w-full rounded-control border border-line bg-surface pl-12 pr-11 text-base outline-none placeholder:text-muted focus:border-accent [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>

      <div aria-live="polite" className="mt-4 max-h-[55vh] overflow-auto">
        {!deferred ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Start typing a movie title to search.
          </p>
        ) : error ? (
          <p role="alert" className="px-1 py-8 text-center text-muted">
            {error}
          </p>
        ) : loading ? (
          <p className="px-1 py-8 text-center text-muted">Searching…</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-8 text-center text-muted">
            No results for <strong className="text-foreground">“{query}”</strong>. Check the spelling and try again.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((r) => {
              const Icon = icons[r.kind];
              return (
                <li key={r.key}>
                  <Link
                    href={r.href}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-control px-2 py-3 transition hover:bg-surface"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-control bg-accent/15 text-accent-text">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="block truncate text-sm text-muted">{r.meta}</span>
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{r.kind}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
