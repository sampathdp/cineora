"use client";

import { useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";
import type { BookingDraft } from "@/types/booking";

/**
 * Remembers the seats a visitor picked while they sign in and review the order (sessionStorage).
 * It is only a convenience: nothing here reserves a seat, and the server decides price and availability.
 */
const DRAFT_KEY = "cineora:draft";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T | null;
    const value = raw ? (JSON.parse(raw) as T) : null;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the draft simply is not remembered */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const isExpired = (d: BookingDraft) => Date.now() - d.createdAt > siteConfig.bookingTtlMs;

/** A fresh Idempotency-Key per selection: retries of the same checkout reuse it, a new selection gets a new one. */
export function newIdempotencyKey() {
  return `bk-${crypto.randomUUID()}`;
}

export const saveDraft = (d: Omit<BookingDraft, "idempotencyKey">) => write(DRAFT_KEY, { ...d, idempotencyKey: newIdempotencyKey() } satisfies BookingDraft);
export const clearDraft = () => write(DRAFT_KEY, null);

/** Returns undefined before hydration, then the stored value or null. */
export function useDraft(): BookingDraft | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read<BookingDraft>(DRAFT_KEY),
    () => undefined,
  );
}
