import type { Metadata } from "next";
import { Suspense } from "react";
import { SeatLayoutQueryPage } from "@/components/admin/seat-layout-editor";

export const metadata: Metadata = { title: "Seat layout" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SeatLayoutQueryPage />
    </Suspense>
  );
}
