import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageHero } from "@/components/ui/section-heading";
import { DemoNotice } from "@/components/ui/misc";
import { ContactForm } from "@/components/layout/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the team (frontend demo form).",
  openGraph: { title: "Contact | CINEORA" },
};

export default function ContactPage() {
  const rows = [
    { icon: MapPin, label: "Address", value: siteConfig.contact.address },
    { icon: Phone, label: "Phone", value: siteConfig.contact.phone },
    { icon: Mail, label: "Email", value: siteConfig.contact.email },
  ];
  return (
    <>
      <PageHero eyebrow="Say hello" title="Contact Us" description="Questions about screenings, groups or private hire? Placeholder details below." />
      <section className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_22rem] lg:py-16">
        <div>
          <DemoNotice className="mb-6">This form validates input but does not send anything.</DemoNotice>
          <ContactForm />
        </div>
        <aside>
          <h2 className="display text-2xl">Reach us</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {rows.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex gap-3 rounded-card border border-line bg-elevated p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
                <div>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </>
  );
}
