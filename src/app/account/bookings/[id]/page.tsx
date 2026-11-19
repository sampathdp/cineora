import type { Metadata } from "next";
import { BookingView } from "@/components/booking/booking-view";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingView id={id} />;
}
