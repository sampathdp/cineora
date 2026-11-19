import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingViewPage } from "@/components/booking/booking-view";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading booking" />}>
      <BookingViewPage />
    </Suspense>
  );
}
