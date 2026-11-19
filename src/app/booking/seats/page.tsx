import type { Metadata } from "next";
import { Suspense } from "react";
import { SeatPickerPage } from "@/components/booking/seat-picker";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Select Seats",
  description: "Choose your seats.",
  robots: { index: false },
};

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading showtime" />}>
      <SeatPickerPage />
    </Suspense>
  );
}
