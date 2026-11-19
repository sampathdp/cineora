import type { Metadata } from "next";
import { RefundsQueue } from "@/components/admin/misc-admin";

export const metadata: Metadata = { title: "Refunds" };

export default function Page() {
  return <RefundsQueue />;
}
