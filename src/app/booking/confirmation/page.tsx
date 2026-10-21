import type { Metadata } from "next";
import { Confirmation } from "@/components/booking/confirmation";

export const metadata: Metadata = {
  title: "Booking Confirmation (Demo)",
  description: "Demonstration confirmation screen. Not a real ticket.",
  robots: { index: false },
};

export default function ConfirmationPage() {
  return <Confirmation />;
}
