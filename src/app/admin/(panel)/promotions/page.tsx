import type { Metadata } from "next";
import { PromotionsAdmin } from "@/components/admin/promotions-admin";

export const metadata: Metadata = { title: "Promotions" };

export default function Page() {
  return <PromotionsAdmin />;
}
