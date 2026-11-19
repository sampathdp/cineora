"use client";

import { useSearchParams } from "next/navigation";
import { content } from "@/lib/api/content";
import { useClientData } from "@/lib/use-client-data";
import { BackLink, EmptyState, PageLoading, Skeleton } from "@/components/ui/misc";
import { ArticleCard, Cover, EventCard, Paragraphs } from "@/components/content/content-bits";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";
import NotFound from "@/app/not-found";

function CardGridLoading() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3]" />
      ))}
    </div>
  );
}

export function EventsList() {
  const { data: events, error, loading } = useClientData("events", () => content.events());
  if (loading) return <CardGridLoading />;
  if (error || !events) return <EmptyState title="Events are temporarily unavailable" description="Please try again in a moment." />;
  if (events.length === 0) return <EmptyState title="No events right now" description="Check back soon." />;
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.slug}>
          <EventCard event={e} />
        </li>
      ))}
    </ul>
  );
}

export function NewsList() {
  const { data: articles, error, loading } = useClientData("articles", () => content.articles());
  if (loading) return <CardGridLoading />;
  if (error || !articles) return <EmptyState title="News is temporarily unavailable" description="Please try again in a moment." />;
  if (articles.length === 0) return <EmptyState title="No articles yet" description="Check back soon." />;
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <li key={a.slug}>
          <ArticleCard article={a} />
        </li>
      ))}
    </ul>
  );
}

function Unavailable({ back, label }: { back: string; label: string }) {
  return (
    <section className="container-page max-w-3xl pb-20 pt-28 sm:pt-32">
      <BackLink href={back}>{label}</BackLink>
      <div className="mt-6">
        <EmptyState title="This page is temporarily unavailable" description="Please try again in a moment." />
      </div>
    </section>
  );
}

export function EventDetail() {
  const slug = useSearchParams().get("slug");
  const { data: e, error, loading } = useClientData(slug ? `event:${slug}` : null, () => content.event(slug!));

  if (!slug) return <NotFound />;
  if (loading) return <PageLoading label="Loading event" />;
  if (error) return <Unavailable back="/events" label="All events" />;
  if (!e) return <NotFound />;

  const when = e.starts_at ? zonedParts(e.starts_at, e.cinema?.timezone ?? "Asia/Seoul") : null;
  return (
    <article className="container-page max-w-3xl pb-20 pt-28 sm:pt-32">
      <title>{`${e.title} | CINEORA`}</title>
      <meta name="description" content={e.seo_description ?? e.summary} />
      <BackLink href="/events">All events</BackLink>
      <h1 className="display mt-2 text-4xl sm:text-6xl">{e.title}</h1>
      {when ? (
        <p className="mt-2 text-muted">
          {formatISODate(when.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {formatTime(when.time)}
          {e.cinema ? ` · ${e.cinema.name}` : ""}
        </p>
      ) : null}
      <div className="my-8 overflow-hidden rounded-card border border-line">
        <Cover src={e.image_url} alt={e.title} />
      </div>
      <Paragraphs items={e.paragraphs ?? []} />
    </article>
  );
}

export function ArticleDetail() {
  const slug = useSearchParams().get("slug");
  const { data: a, error, loading } = useClientData(slug ? `article:${slug}` : null, () => content.article(slug!));

  if (!slug) return <NotFound />;
  if (loading) return <PageLoading label="Loading article" />;
  if (error) return <Unavailable back="/news" label="All news" />;
  if (!a) return <NotFound />;

  return (
    <article className="container-page max-w-3xl pb-20 pt-28 sm:pt-32">
      <title>{`${a.title} | CINEORA`}</title>
      <meta name="description" content={a.seo_description ?? a.excerpt} />
      <BackLink href="/news">All news</BackLink>
      {a.category ? <p className="eyebrow mt-2">{a.category.name}</p> : null}
      <h1 className="display mt-1 text-4xl sm:text-6xl">{a.title}</h1>
      {a.published_at ? <p className="mt-2 text-muted">{formatISODate(a.published_at.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</p> : null}
      <div className="my-8 overflow-hidden rounded-card border border-line">
        <Cover src={a.image_url} alt={a.title} />
      </div>
      <Paragraphs items={a.paragraphs ?? []} />
    </article>
  );
}
