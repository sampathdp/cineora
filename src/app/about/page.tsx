import type { Metadata } from "next";
import { Clapperboard, Film, HeartHandshake, MessageCircle, QrCode, Users } from "lucide-react";
import { PageHero } from "@/components/ui/section-heading";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Art } from "@/components/ui/art";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "About",
  description: "AR Entertainment brings Sri Lankan films to the big screen in South Korea.",
  openGraph: { title: "About | AR ENTERTAINMENT" },
};

const WHATSAPP_URL = "https://wa.me/821043937461";

const features = [
  { icon: Film, title: "Sri Lankan premieres", text: "New Sinhala films on a real cinema screen in Korea, the way they were made to be seen." },
  { icon: Clapperboard, title: "Partner cinemas", text: "Screenings in multiplexes such as CGV, with proper sound, comfortable seats and a full house." },
  { icon: Users, title: "Community nights", text: "Every premiere is a get-together for Sri Lankans living, working and studying across Korea." },
  { icon: QrCode, title: "Simple booking", text: "Choose your seats online, pay by bank transfer and get a QR ticket on your phone." },
  { icon: HeartHandshake, title: "Backing filmmakers", text: "Each ticket helps Sri Lankan films reach audiences beyond home." },
  { icon: MessageCircle, title: "Easy to reach", text: "Questions about a show? Call, WhatsApp or message us on Facebook." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our story"
        title="About AR Entertainment"
        description="Bringing Sri Lankan cinema to the big screen in South Korea."
      />
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
              label="Cinema auditorium and seating"
            />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="display text-4xl sm:text-5xl">A taste of home, on the big screen</h2>
          <p className="mt-4 text-muted">
            AR Entertainment (엔터코리아 AR) is a Korea-based film promoter. We bring Sri Lankan films to cinemas across South
            Korea, so the Sri Lankan community here can watch new releases together, in our own language, on a proper screen.
          </p>
          <p className="mt-3 text-muted">
            We work with local cinemas such as CGV to host premieres and special screenings. Recent shows include the Sinhala film
            “එදා රෑ” at CGV Ansan.
          </p>
          <p className="mt-3 text-muted">Led by Anjana Ravinath, AR Entertainment is run by Sri Lankans in Korea, for Sri Lankans in Korea.</p>
          <LinkButton href="/movies" size="lg" className="mt-6">
            See what&apos;s on
          </LinkButton>
        </Reveal>
      </section>
      <section className="border-t border-line bg-surface py-14 lg:py-20">
        <div className="container-page">
          <h2 className="display text-center text-4xl sm:text-5xl">What we do</h2>
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
      <section className="container-page py-14 text-center lg:py-20">
        <h2 className="display text-4xl sm:text-5xl">Bring a film to your city</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Want a screening near you, group tickets, or to partner with us on a release? Get in touch.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href="/contact" size="lg">
            Contact us
          </LinkButton>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg")}>
            <MessageCircle className="size-5" aria-hidden /> WhatsApp us
          </a>
        </div>
      </section>
    </>
  );
}
