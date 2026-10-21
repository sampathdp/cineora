import type { Metadata } from "next";
import { PageHero } from "@/components/ui/section-heading";
import { DemoNotice } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Placeholder terms for the CINEORA frontend demo.",
};

const sections = [
  ["Demonstration only", "This website is a frontend demonstration. No real bookings, payments or tickets are created, and nothing displayed constitutes an offer to sell."],
  ["Fictional content", "All films, people, venues, showtimes, prices, events and reviews are fictional sample content."],
  ["Bank details", "Any bank details shown are fictional placeholders. Do not send money to them."],
  ["Changes", "These placeholder terms will be replaced by reviewed legal text before any production release."],
];

export default function TermsPage() {
  return (
    <>
      <PageHero title="Terms & Conditions" eyebrow="Legal" />
      <section className="container-page max-w-3xl py-12">
        <DemoNotice>Placeholder copy. Replace with reviewed terms before any production use.</DemoNotice>
        <div className="mt-8 space-y-8">
          {sections.map(([h, p]) => (
            <div key={h}>
              <h2 className="display text-2xl">{h}</h2>
              <p className="mt-2 text-muted">{p}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
