import type { Metadata } from "next";
import { BookingList } from "@/components/booking/booking-view";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function Page() {
  return <BookingList />;
}
