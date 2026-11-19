import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content } from "@/lib/api/content";
import { BackLink } from "@/components/ui/misc";
import { Cover, Paragraphs } from "@/components/content/content-bits";
import { formatISODate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await content.article((await params).slug).catch(() => null);
  return a ? { title: a.title, description: a.seo_description ?? a.excerpt } : { title: "Article not found" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = await content.article((await params).slug);
  if (!a) notFound();
  return (
    <article className="container-page max-w-3xl pb-20 pt-28 sm:pt-32">
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
