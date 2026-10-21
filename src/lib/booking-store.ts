"use client";

import { useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";
import type { BookingDraft, DemoBooking } from "@/types/booking";

/**
 * Tiny frontend-only store backed by sessionStorage. Swap the read/write
 * functions for API calls when a backend is introduced.
 */
const DRAFT_KEY = "cineora:draft";
const BOOKING_KEY = "cineora:booking";

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
    /* storage unavailable: store silently no-ops */
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

export const saveDraft = (d: BookingDraft) => write(DRAFT_KEY, d);
export const clearDraft = () => write(DRAFT_KEY, null);
export const saveBooking = (b: DemoBooking) => write(BOOKING_KEY, b);

/** Returns undefined before hydration, then the stored value or null. */
function useStored<T>(key: string): T | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read<T>(key),
    () => undefined,
  );
}

export const useDraft = () => useStored<BookingDraft>(DRAFT_KEY);
export const useBooking = () => useStored<DemoBooking>(BOOKING_KEY);

export function generateReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `CIN-${out}`;
}

/** Builds and stores a demo booking from the current draft. Returns the booking. */
export function confirmDemoBooking(
  draft: BookingDraft,
  extra: Pick<DemoBooking, "customer" | "paymentReference" | "proofFileName" | "total">,
): DemoBooking {
  const booking: DemoBooking = { ...draft, ...extra, reference: generateReference(), confirmedAt: Date.now() };
  saveBooking(booking);
  return booking;
}
