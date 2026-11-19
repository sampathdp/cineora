import type { Metadata } from "next";
import { TicketScanner } from "@/components/admin/ticket-scanner";

export const metadata: Metadata = { title: "Scan tickets" };

export default function Page() {
  return <TicketScanner />;
}
