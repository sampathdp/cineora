import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";

export const metadata: Metadata = { title: "Terms & Conditions", description: "The terms for booking tickets with Cineora." };

const defaults: [string, string][] = [
  ["Booking and seat holds", "When you reserve seats we hold them for a limited time while you pay by bank transfer. If we do not receive your payment proof in time, the seats are released automatically."],
  ["Payment", "Payment is by bank transfer to the account shown on your booking page. A booking is only confirmed, and tickets are only issued, after our staff have verified your transfer. Always include your booking reference in the transfer memo."],
  ["Tickets", "Each seat has its own ticket with a QR code. A ticket admits one person once. Keep your QR code private: anyone who presents it first can be admitted."],
  ["Refunds", "You can request a refund of a confirmed booking until shortly before the show, as long as no ticket has been used. Refunds are paid back by bank transfer once approved."],
  ["Changes to showings", "If a showing is cancelled we will contact you and refund your payment."],
  ["Conduct", "Please follow the cinema's house rules and age classifications. We may refuse entry where required."],
];

export default function TermsPage() {
  return <LegalPage pageKey="terms" title="Terms & Conditions" defaults={defaults} />;
}
