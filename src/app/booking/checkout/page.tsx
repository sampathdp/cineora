import type { Metadata } from "next";
import { Checkout } from "@/components/booking/checkout";

export const metadata: Metadata = {
  title: "Checkout (Demo)",
  description: "Frontend-only demo checkout with bank transfer instructions.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
