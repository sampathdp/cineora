import type { Metadata } from "next";
import { Armchair, MonitorPlay, QrCode, ShieldCheck, Ticket, Users } from "lucide-react";
import { PageHero } from "@/components/ui/section-heading";
import { LinkButton } from "@/components/ui/button";
import { Art } from "@/components/ui/art";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: "The story behind CINEORA.",
  openGraph: { title: "About | CINEORA" },
};

const features = [
  { icon: Ticket, title: "Effortless booking", text: "From showtime to seat map in a few clear steps." },
  { icon: ShieldCheck, title: "Flexible payment", text: "Pay by bank transfer; our team verifies it and issues your tickets." },
  { icon: QrCode, title: "Digital tickets", text: "A QR ticket for every seat, ready on your phone or printed." },
  { icon: Armchair, title: "Comfort first", text: "Standard, premium and lounge seating categories." },
  { icon: MonitorPlay, title: "Great presentation", text: "Large-format screens in selected venues." },
  { icon: Users, title: "For everyone", text: "Family days, festivals and relaxed screenings." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Our story" title={`About ${siteConfig.name}`} description="A modern cinema where choosing a film, a seat and a showtime feels as good as the film itself." />
      <section className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
        <Reveal>
          <div className="aspect-[4/3] overflow-hidden rounded-card border border-line shadow-card">
            <Art
              art={{
                from: "#3a1a08",
                to: "#07060a",
                accent: "#f0782b",
                motif: "city",
                image: "/images/about/cinema-about.jpg",
              }}
              seed="about"
              label="Modern cinema auditorium and seating"
            />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="display text-4xl sm:text-5xl">Cinema is better together</h2>
          <p className="mt-4 text-muted">
            {siteConfig.name} imagines a modern cinema where choosing a film, a seat and a showtime feels as good as the film itself.
          </p>
          <p className="mt-3 text-muted">Book online, pay by bank transfer, and walk in with a QR ticket.</p>
          <LinkButton href="/movies" size="lg" className="mt-6">
            See what&apos;s on
          </LinkButton>
        </Reveal>
      </section>
      <section className="border-t border-line bg-surface py-14 lg:py-20">
        <div className="container-page">
          <h2 className="display text-center text-4xl sm:text-5xl">What we focus on</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-card border border-line bg-elevated p-6">
                <Icon className="size-8 text-accent-text" aria-hidden />
                <h3 className="display mt-4 text-2xl">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
