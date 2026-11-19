import type { Metadata } from "next";
import { BookingsAdmin } from "@/components/admin/bookings-admin";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return <BookingsAdmin />;
}
