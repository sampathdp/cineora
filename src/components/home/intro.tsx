import { CreditCard, MousePointerClick, QrCode } from "lucide-react";
import { Art } from "@/components/ui/art";
import { LinkButton } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

const highlights = [
  { icon: MousePointerClick, title: "Easy booking", text: "Pick a film, a showtime and your exact seats in minutes." },
  { icon: CreditCard, title: "Flexible payment", text: "Pay by bank transfer; our team verifies it and issues your tickets." },
  { icon: QrCode, title: "Digital tickets", text: "A QR ticket for every seat, on your phone or printed." },
];

export function Intro() {
  return (
    <section className="section-y overflow-hidden" aria-labelledby="intro-heading">
      <div className="container-page grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <div className="relative mx-auto aspect-[5/4] w-full max-w-xl">
            <div className="absolute left-0 top-6 h-[78%] w-[62%] -rotate-6 overflow-hidden rounded-card border-4 border-background shadow-card">
              <Art
                art={{
                  from: "#0f4c5c",
                  to: "#04141a",
                  accent: "#f7a35c",
                  motif: "mountains",
                  image: "/images/about/intro-1.jpg",
                }}
                seed="intro-a"
                label="Cinematic landscape"
              />
            </div>
            <div className="absolute right-0 top-0 h-[68%] w-[44%] rotate-3 overflow-hidden rounded-card border-4 border-background shadow-card">
              <Art
                art={{
                  from: "#3a1a08",
                  to: "#07060a",
                  accent: "#f0782b",
                  motif: "moon",
                  image: "/images/about/intro-2.jpg",
                }}
                seed="intro-b"
                label="Classic cinema movie night"
              />
            </div>
            <div className="absolute -bottom-2 left-[46%] grid size-28 place-items-center rounded-full border-2 border-dashed border-accent bg-background text-center shadow-card sm:size-32">
              <p>
                <span className="display block text-4xl text-accent-text">24/7</span>
                <span className="block text-[0.65rem] font-semibold uppercase leading-tight tracking-wider text-muted">
                  online booking
                </span>
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="eyebrow">Get to know us</p>
          <h2 id="intro-heading" className="display mt-3 text-4xl sm:text-5xl lg:text-6xl">
            The best movie ticket distributor
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-muted">
            Cineora brings the screens together in one place: discover films, compare showtimes and choose your perfect seat.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="size-8 text-accent-text" aria-hidden />
                <h3 className="display mt-3 text-xl">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
          <LinkButton href="/about" size="lg" className="mt-8">
            Discover More
          </LinkButton>
        </Reveal>
      </div>
    </section>
  );
}
