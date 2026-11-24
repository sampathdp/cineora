import { Star } from "lucide-react";

export type StripeStat = { value: string; label: string };

/**
 * Two crossed bands: a dark film strip (sprocket holes, outlined labels) scrolling one way
 * behind an accent band with the stats scrolling the other way.
 */
export function StatsStripe({ stats }: { stats: StripeStat[] }) {
  if (stats.length === 0) return null;

  const statRow = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {stats.map((s) => (
        <li key={s.label} className="flex items-center">
          <span className="flex items-baseline gap-3 px-8 sm:px-10">
            <span className="display text-3xl sm:text-4xl">{s.value}</span>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] opacity-80 sm:text-xs">
              {s.label}
            </span>
          </span>
          <Star className="size-3.5 fill-current opacity-70" aria-hidden />
        </li>
      ))}
    </ul>
  );

  const filmRow = () => (
    <ul aria-hidden className="flex shrink-0 items-center">
      {stats.map((s) => (
        <li
          key={s.label}
          className="stripe-outline display px-8 text-2xl sm:text-3xl"
        >
          {s.label}
          <span className="mx-8 inline-block size-1.5 rounded-full bg-white/40 align-middle" />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Cinema stats" className="relative isolate overflow-hidden py-16 sm:py-20">
      {/* Back band: film strip */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-[3deg] bg-neutral-950 text-white"
      >
        <div className="stripe-sprockets h-3" />
        <div className="py-2">
          <div className="stripe-marquee stripe-marquee-reverse flex w-max">
            {filmRow()}
            {filmRow()}
          </div>
        </div>
        <div className="stripe-sprockets h-3" />
      </div>

      {/* Front band: stats */}
      <div className="relative z-10 -ml-[15%] w-[130%] -rotate-2 bg-accent text-on-accent shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)]">
        <div className="border-y border-black/15 py-5">
          <div className="stripe-marquee flex w-max">
            {statRow(false)}
            {statRow(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
