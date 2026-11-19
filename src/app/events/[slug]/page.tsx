import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content } from "@/lib/api/content";
import { BackLink } from "@/components/ui/misc";
import { Cover, Paragraphs } from "@/components/content/content-bits";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await content.event((await params).slug).catch(() => null);
  return e ? { title: e.title, description: e.seo_description ?? e.summary } : { title: "Event not found" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await content.event((await params).slug);
  if (!e) notFound();
  const when = e.starts_at ? zonedParts(e.starts_at, e.cinema?.timezone ?? "Asia/Seoul") : null;
  return (
    <article className="container-page max-w-3xl pb-20 pt-28 sm:pt-32">
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
