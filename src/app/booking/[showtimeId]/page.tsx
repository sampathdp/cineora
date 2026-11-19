import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShowtimeForPage } from "@/lib/api/catalog";
import { SeatPicker } from "@/components/booking/seat-picker";

type Params = { showtimeId: string };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Select Seats",
  description: "Choose your seats.",
  robots: { index: false },
};

export default async function SeatSelectionPage({ params }: { params: Promise<Params> }) {
  const { showtimeId } = await params;
  const showtime = await getShowtimeForPage(showtimeId); // throws on API failure -> error boundary; null is a real 404
  if (!showtime) notFound();

  return <SeatPicker showtime={showtime} />;
}
