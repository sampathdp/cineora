"use client";

import { useEffect, useState } from "react";
import type { Movie } from "@/types/movie";
import { ApiError } from "./client";
import { searchMovies, type MovieQuery } from "./catalog";

interface Result {
  key: string;
  movies?: Movie[];
  error?: string;
}

/**
 * Server-side filtered movie search with debounce, cancellation and retry.
 * `initial` lets a server component hand over the first page so the first paint needs no request.
 */
export function useMovieSearch(query: MovieQuery, options: { enabled?: boolean; initial?: Movie[]; debounceMs?: number } = {}) {
  const { enabled = true, initial, debounceMs = 250 } = options;
  const key = JSON.stringify(query);
  const [result, setResult] = useState<Result | null>(initial ? { key, movies: initial } : null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (result?.key === key && !result.error && attempt === 0) return; // already have this exact answer
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchMovies(JSON.parse(key) as MovieQuery, controller.signal)
        .then((movies) => setResult({ key, movies }))
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setResult({ key, error: e instanceof ApiError && !e.isNetwork ? e.message : "Could not load movies. Check your connection and try again." });
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `result` is intentionally read only for the already-have-it shortcut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, enabled, debounceMs]);

  const current = result?.key === key ? result : null;
  return {
    movies: current?.movies ?? null,
    loading: enabled && current === null,
    error: current?.error ?? null,
    retry: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
