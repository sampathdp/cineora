import type { Metadata } from "next";
import { PageHero } from "@/components/ui/section-heading";
import { NewsList } from "@/components/content/content-pages";

export const metadata: Metadata = { title: "News", description: "News, reviews and announcements from the cinema." };

export default function NewsPage() {
  return (
    <>
      <PageHero eyebrow="Latest" title="News" description="Announcements, reviews and stories from the cinema." />
      <section className="container-page py-12 lg:py-16">
        <NewsList />
      </section>
    </>
  );
}
