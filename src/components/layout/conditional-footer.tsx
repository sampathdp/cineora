"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders the consumer website footer only on non-admin routes.
 * The Admin portal has its own dedicated full-height layout without the consumer footer.
 */
export function ConditionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }
  return <>{children}</>;
}

