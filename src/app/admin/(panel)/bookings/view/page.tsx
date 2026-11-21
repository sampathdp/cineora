import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingDetailPage } from "@/components/admin/bookings-admin";

export const metadata: Metadata = { title: "Booking" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookingDetailPage />
    </Suspense>
  );
}
