"use client";

import { themeInitScript } from "./theme-provider";

/**
 * Inline pre-paint theme script. On the client the type is switched so React
 * doesn't warn about (never-executed) script tags; the server HTML copy has
 * already run before first paint.
 */
export function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      type={typeof window === "undefined" ? undefined : "application/json"}
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
