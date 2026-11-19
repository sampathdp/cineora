import type { Metadata } from "next";
import { Checkout } from "@/components/booking/checkout";

export const metadata: Metadata = {
  title: "Reserve seats",
  description: "Review your selection and reserve your seats.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
