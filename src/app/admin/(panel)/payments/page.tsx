import type { Metadata } from "next";
import { PaymentsQueue } from "@/components/admin/payments-queue";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <PaymentsQueue />;
}
