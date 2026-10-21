import { Quote } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { StarRating } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  const average = testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length;

  return (
    <section className="section-y relative overflow-hidden bg-surface" aria-labelledby="why-heading">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why choose us</p>
          <h2 id="why-heading" className="display mt-3 text-4xl sm:text-5xl lg:text-6xl">
            Loved by movie fans
          </h2>
          <p className="mt-4 inline-flex items-center gap-3 rounded-full border border-line bg-elevated px-4 py-2 text-sm text-muted">
            <StarRating value={Math.round(average)} />
            <span>
              <strong className="text-foreground">{average.toFixed(1)}</strong> average from demo reviews
            </span>
          </p>
        </div>

        <ul className="mt-14 grid gap-6 md:grid-cols-3 md:items-stretch">
          {testimonials.map((t, i) => (
            <li key={t.id} className={cn("flex", i === 1 && "md:-translate-y-4")}>
              <Reveal className="flex w-full" delay={i * 0.1}>
                <figure
                  className={cn(
                    "relative flex w-full flex-col rounded-3xl border p-7 shadow-card transition hover:-translate-y-1",
                    i === 1 ? "border-accent/50 bg-elevated" : "border-line bg-elevated/70",
                  )}
                >
                  <Quote className="size-10 text-accent/70" aria-hidden />
                  <StarRating value={t.rating} className="mt-4" />
                  <blockquote className="mt-4 flex-1 text-pretty text-lg leading-relaxed">{t.quote}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-accent/30"
                      style={{ background: t.tone }}
                      aria-hidden
                    >
                      {t.initials}
                    </span>
                    <span>
                      <span className="block font-bold">{t.name}</span>
                      <span className="block text-sm text-muted">{t.title}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-xs text-muted">
          Illustrative demo testimonials from fictional profiles, not real customer reviews.
        </p>
      </div>
    </section>
  );
}
