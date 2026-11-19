import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getSite } from "@/lib/api/content";
import { PageHero } from "@/components/ui/section-heading";
import { ContactForm } from "@/components/layout/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the team.",
  openGraph: { title: "Contact | CINEORA" },
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const site = await getSite();
  const rows = [
    { icon: MapPin, label: "Address", value: site.contact.address },
    { icon: Phone, label: "Phone", value: site.contact.phone },
    { icon: Mail, label: "Email", value: site.contact.email },
    ...(site.contact.hours ? [{ icon: Clock, label: "Hours", value: site.contact.hours }] : []),
  ];
  return (
    <>
      <PageHero eyebrow="Say hello" title="Contact Us" description="Questions about screenings, groups or private hire? We would love to hear from you." />
      <section className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_22rem] lg:py-16">
        <div>
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
