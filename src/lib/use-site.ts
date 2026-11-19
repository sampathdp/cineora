"use client";

import { useEffect, useState } from "react";
import { getSite, siteFallback, type SiteInfo } from "@/lib/api/content";

/** Site details for client components: the built-in defaults first, then the admin-managed values once loaded. */
export function useSite(): { site: SiteInfo; loaded: boolean } {
  const [site, setSite] = useState<SiteInfo | null>(null);
  useEffect(() => {
    let live = true;
    getSite().then((s) => {
      if (live) setSite(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return { site: site ?? siteFallback, loaded: site !== null };
}
