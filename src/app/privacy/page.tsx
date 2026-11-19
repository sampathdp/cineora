import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Policy", description: "How Cineora handles your personal data." };

const defaults: [string, string][] = [
  ["What we collect", "When you create an account we store your name, email address, optional phone number and a securely hashed password. When you book we store the booking, the seats, the amount, and the bank-transfer receipt you upload. If you write to us or subscribe to the newsletter we store what you send."],
  ["How receipts are protected", "Payment receipts are kept in private storage that is never publicly accessible. Only you and authorised staff who verify payments for the relevant cinema can open them, and each staff access is logged."],
  ["Cookies and local storage", "We use a session cookie and a security (CSRF) cookie to keep you signed in and to protect your requests. Your theme choice is kept in your browser's local storage and your seat selection, until you reserve, in its session storage. We do not use advertising or tracking cookies."],
  ["Who sees your data", "Staff only see what their role needs: ticket checkers see only seat, film and time; payment verifiers see the booking and receipt but not your contact details; administrators can see more and every sensitive action is recorded in an audit log."],
  ["Email", "We email you about your booking, payment decisions and tickets. Newsletters are sent only if you subscribed."],
  ["Your choices", "You can change your details in your account. To ask for a copy of your data or for deletion, contact us using the details on the Contact page. We keep booking and payment records for as long as the law requires."],
];

export default function PrivacyPage() {
  return <LegalPage pageKey="privacy" title="Privacy Policy" defaults={defaults} />;
}
