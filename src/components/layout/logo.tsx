/* eslint-disable @next/next/no-img-element -- static export: plain <img> for the brand artwork */
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Brand artwork from public/brand. Both versions are rendered and CSS shows the one that matches the theme
 * (`.dark` on <html>) or a dark backdrop (`.on-dark`), so there is no flash while the theme script runs.
 */
export function BrandImage({ kind = "logo", className, onDark = false }: { kind?: "logo" | "mark"; className?: string; onDark?: boolean }) {
  const size = kind === "logo" ? { width: 720, height: 273 } : { width: 160, height: 155 };
  return (
    <span className={cn("inline-block", onDark && "on-dark")}>
      <img src={`/brand/${kind}-light.webp`} alt={siteConfig.name} {...size} className={cn("brand-on-light w-auto", className)} />
      <img src={`/brand/${kind}-dark.webp`} alt="" aria-hidden {...size} className={cn("brand-on-dark w-auto", className)} />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${siteConfig.name} home`} className={cn("inline-flex items-center", className)}>
      <BrandImage className="h-10 lg:h-12" />
    </Link>
  );
}
