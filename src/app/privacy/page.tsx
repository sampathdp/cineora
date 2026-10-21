import type { Metadata } from "next";
import { PageHero } from "@/components/ui/section-heading";
import { DemoNotice } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Placeholder privacy policy for the CINEORA frontend demo.",
};

const sections = [
  ["What this demo stores", "This frontend demo keeps your theme choice in localStorage and temporary booking selections in sessionStorage in your own browser. Nothing is transmitted to a server."],
  ["Forms", "The contact, newsletter and checkout forms validate input locally. They do not send, store or share the information you type."],
  ["Cookies", "No tracking or advertising cookies are used by this demo."],
  ["Your choices", "Clear your browser's site data at any time to remove everything this demo has stored."],
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy Policy" eyebrow="Legal" />
      <section className="container-page max-w-3xl py-12">
        <DemoNotice>Placeholder copy. Replace with a reviewed policy before any production use.</DemoNotice>
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
