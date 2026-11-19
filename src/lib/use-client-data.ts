"use client";

import { useEffect, useState } from "react";

export interface ClientData<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Loads data in the browser (the site is a static export, so pages cannot fetch on a server).
 * `key` identifies the request: when it changes the previous result is discarded and the loader runs again.
 * A null key means "nothing to load yet".
 */
export function useClientData<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): ClientData<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown } | null>(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ key, error: error ?? new Error("Request failed") });
      },
    );
    return () => controller.abort();
    // The loader is intentionally keyed by `key` only, so inline arrow functions do not refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = key !== null && state?.key === key ? state : null;
  return { data: current?.data, error: current?.error, loading: key !== null && current === null };
}
