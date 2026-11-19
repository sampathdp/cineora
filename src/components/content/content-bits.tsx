import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import type { ArticleSummary, EventSummary } from "@/lib/api/content";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";

/** Plain-text paragraphs, escaped by React: editors cannot inject markup. */
export function Paragraphs({ items }: { items: string[] }) {
  return (
    <div className="space-y-5 text-lg leading-relaxed text-pretty">
      {items.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function Cover({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="aspect-[16/9] bg-gradient-to-br from-surface to-elevated" aria-hidden />;
  return (
    <div className="relative aspect-[16/9]">
      <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
    </div>
  );
}

export function EventCard({ event }: { event: EventSummary }) {
  const tz = event.cinema?.timezone ?? "Asia/Seoul";
  const when = event.starts_at ? zonedParts(event.starts_at, tz) : null;
  return (
    <article className="overflow-hidden rounded-card border border-line bg-elevated shadow-card transition hover:border-accent">
      <Cover src={event.image_url} alt="" />
      <div className="p-5">
        <h2 className="display text-2xl">
          <Link href={`/events/${event.slug}`} className="hover:text-accent-text">
            {event.title}
          </Link>
        </h2>
        {when ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Calendar className="size-4" aria-hidden /> {formatISODate(when.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {formatTime(when.time)}
          </p>
        ) : null}
        {event.cinema ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <MapPin className="size-4" aria-hidden /> {event.cinema.name}
          </p>
        ) : null}
        <p className="mt-3 text-muted">{event.summary}</p>
      </div>
    </article>
  );
}

export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="overflow-hidden rounded-card border border-line bg-elevated shadow-card transition hover:border-accent">
      <Cover src={article.image_url} alt="" />
      <div className="p-5">
        {article.category ? <p className="eyebrow">{article.category.name}</p> : null}
        <h2 className="display mt-1 text-2xl">
          <Link href={`/news/${article.slug}`} className="hover:text-accent-text">
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 text-muted">{article.excerpt}</p>
        {article.published_at ? <p className="mt-3 text-xs text-muted">{formatISODate(article.published_at.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</p> : null}
      </div>
    </article>
  );
}
