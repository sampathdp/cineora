import type { Metadata } from "next";
import { content } from "@/lib/api/content";
import { PageHero } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/misc";
import { ArticleCard } from "@/components/content/content-bits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "News", description: "News, reviews and announcements from the cinema." };

export default async function NewsPage() {
  const articles = await content.articles().catch(() => null);
  return (
    <>
      <PageHero eyebrow="Latest" title="News" description="Announcements, reviews and stories from the cinema." />
      <section className="container-page py-12 lg:py-16">
        {articles === null ? (
          <EmptyState title="News is temporarily unavailable" description="Please try again in a moment." />
        ) : articles.length === 0 ? (
          <EmptyState title="No articles yet" description="Check back soon." />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
