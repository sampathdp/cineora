import type { ReactNode } from "react";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  as: Tag = "h2",
  className,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  as?: "h1" | "h2";
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        action ? "sm:flex-row sm:items-end sm:justify-between" : "",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-3", align === "center" ? "items-center" : "items-start")}>
        {eyebrow ? (
          <p className="eyebrow inline-flex items-center gap-2">
            <Clapperboard className="size-4" aria-hidden /> {eyebrow}
          </p>
        ) : null}
        <Tag className="display text-4xl sm:text-5xl lg:text-6xl">{title}</Tag>
        {description ? <p className="max-w-2xl text-pretty text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHero({ title, eyebrow, description }: { title: ReactNode; eyebrow?: string; description?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface pt-32 pb-12 sm:pt-40 sm:pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div className="container-page relative">
        <SectionHeading as="h1" align="left" eyebrow={eyebrow} title={title} description={description} />
      </div>
    </section>
  );
}
