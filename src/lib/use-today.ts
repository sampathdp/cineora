"use client";

import { useSyncExternalStore } from "react";
import { addDays } from "./formatters";

const subscribe = () => () => {};

/**
 * Client-only "now". Returns null during SSR/hydration so locale/timezone-dependent
 * date labels never cause hydration mismatches.
 */
export function useDays(count: number): Date[] | null {
  const key = useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date();
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    },
    () => null,
  );
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(y, m, d);
  return Array.from({ length: count }, (_, i) => addDays(i, base));
}
