import type { Metadata } from "next";
import { PageHero } from "@/components/ui/section-heading";
import { ContactForm } from "@/components/layout/contact-form";
import { ContactDetails } from "@/components/layout/contact-details";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the team.",
  openGraph: { title: "Contact | AR ENTERTAINMENT" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Say hello" title="Contact Us" description="Questions about screenings, groups or private hire? We would love to hear from you." />
      <section className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_22rem] lg:py-16">
        <div>
          <ContactForm />
        </div>
        <aside>
          <h2 className="display text-2xl">Reach us</h2>
          <ContactDetails />
        </aside>
      </section>
    </>
  );
}
