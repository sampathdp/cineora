import type { ReactNode } from "react";
import Link from "next/link";
import { Star, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./button";

export function StarRating({ value, max = 5, className }: { value: number; max?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} aria-hidden className={cn("size-4", i < value ? "fill-accent text-accent" : "text-muted/50")} />
      ))}
    </span>
  );
}

export function Badge({ children, className, tone = "accent" }: { children: ReactNode; className?: string; tone?: "accent" | "neutral" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider",
        tone === "accent" && "bg-accent text-on-accent",
        tone === "neutral" && "border border-line bg-surface text-muted",
        tone === "dark" && "bg-black/60 text-white backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-6 py-16 text-center">
      <Film className="size-10 text-accent-text" aria-hidden />
      <p className="display text-2xl">{title}</p>
      {description ? <p className="max-w-md text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function DemoNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-card border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-foreground",
        className,
      )}
    >
      <strong className="mr-1 text-accent-text">Frontend demo.</strong>
      {children}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass("ghost", "sm", "-ml-3")}>
      ← {children}
    </Link>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-card bg-surface", className)} />;
}

/** Shown when the catalogue API cannot be reached (or has no published titles yet). */
export function CatalogUnavailable({ inline, empty }: { inline?: boolean; empty?: boolean }) {
  const body = (
    <EmptyState
      title={empty ? "No movies yet" : "Movies are temporarily unavailable"}
      description={empty ? "Check back soon for what is showing." : "We could not load the catalogue. Please try again in a moment."}
      action={
        <a href="" className={buttonClass("secondary", "md")}>
          Reload
        </a>
      }
    />
  );
  return inline ? body : <section className="container-page pb-20 pt-32">{body}</section>;
}
