import type { Metadata } from "next";
import { MyTickets } from "@/components/booking/my-tickets";

export const metadata: Metadata = { title: "My tickets", robots: { index: false } };

export default function Page() {
  return <MyTickets />;
}
