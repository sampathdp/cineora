import type { Metadata } from "next";
import { PageHero } from "@/components/ui/section-heading";
import { EventsList } from "@/components/content/content-pages";

export const metadata: Metadata = { title: "Events", description: "Special screenings, festivals and cinema events." };

export default function EventsPage() {
  return (
    <>
      <PageHero eyebrow="What's on" title="Events" description="Special screenings, festivals and community nights." />
      <section className="container-page py-12 lg:py-16">
        <EventsList />
      </section>
    </>
  );
}
