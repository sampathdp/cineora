import type { Metadata } from "next";
import { content } from "@/lib/api/content";
import { PageHero } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/misc";
import { EventCard } from "@/components/content/content-bits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events", description: "Special screenings, festivals and cinema events." };

export default async function EventsPage() {
  const events = await content.events().catch(() => null);
  return (
    <>
      <PageHero eyebrow="What's on" title="Events" description="Special screenings, festivals and community nights." />
      <section className="container-page py-12 lg:py-16">
        {events === null ? (
          <EmptyState title="Events are temporarily unavailable" description="Please try again in a moment." />
        ) : events.length === 0 ? (
          <EmptyState title="No events right now" description="Check back soon." />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <li key={e.slug}>
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
