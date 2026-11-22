import { Star } from "lucide-react";

export type StripeStat = { value: string; label: string };

/** Tilted accent band with an endlessly scrolling row of stats. */
export function StatsStripe({ stats }: { stats: StripeStat[] }) {
  if (stats.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {stats.map((s) => (
        <li key={s.label} className="flex items-center gap-3 px-6 sm:px-8">
          <span className="display text-2xl sm:text-3xl">{s.value}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm">{s.label}</span>
          <Star className="ml-6 size-4 fill-current sm:ml-8" aria-hidden />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Cinema stats" className="relative overflow-hidden py-10">
      <div className="-ml-[5%] w-[110%] -rotate-2 bg-accent py-4 text-on-accent shadow-card">
        <div className="stripe-marquee flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}
