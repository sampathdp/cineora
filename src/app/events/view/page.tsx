import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetail } from "@/components/content/content-pages";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Event" };

export default function EventPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading event" />}>
      <EventDetail />
    </Suspense>
  );
}
