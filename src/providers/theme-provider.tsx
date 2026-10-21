"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "cineora-theme";
const DEFAULT_THEME: ThemePreference = "dark";

/** Runs before first paint (inlined in <head>) so there is no theme flash. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem("${STORAGE_KEY}");var p=(s==="light"||s==="dark"||s==="system")?s:"${DEFAULT_THEME}";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePreference, animate: boolean) {
  const root = document.documentElement;
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 300);
  }
  root.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state matches the server render; real value is read after mount.
  const [preference, setPref] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const pref: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system" ? stored : DEFAULT_THEME;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with external storage after hydration
    setPref(pref);
    setResolved(apply(pref, false));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system", false));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    setResolved(apply(p, true));
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
