import type { Metadata } from "next";
import Image from "next/image";
import { LinkButton } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { CityClock } from "@/components/about/city-clock";
import { ContactChannels } from "@/components/contact/contact-channels";

export const metadata: Metadata = {
  title: "About",
  description:
    "AR Entertainment brings Sri Lankan films to cinema screens in South Korea.",
  openGraph: { title: "About | AR ENTERTAINMENT" },
};

const cities = [
  {
    name: "Colombo",
    line: "Where the films are made.",
    image: "/images/about/colombo.webp",
    alt: "Street in Colombo Fort with three-wheelers and a colonial-era building",
    timeZone: "Asia/Colombo",
    offset: "UTC+5:30",
  },
  {
    name: "Ansan",
    line: "Where we watch them together.",
    image: "/images/about/ansan.webp",
    alt: "Ansan Station in Gyeonggi-do, South Korea",
    timeZone: "Asia/Seoul",
    offset: "UTC+9",
  },
];

const night = [
  {
    title: "Pick your seats",
    text: "Choose the film, the showtime and your seats on this site.",
  },
  {
    title: "Pay by bank transfer",
    text: "Send the amount to our account. We check it and confirm your booking.",
  },
  {
    title: "Get your QR ticket",
    text: "One ticket per seat, on your phone or printed.",
  },
  {
    title: "Meet everyone there",
    text: "Arrive early, find friends from home, and watch the film with a full house.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* The screen: the place every story on this page ends up. */}
      <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden">
        <Image
          src="/images/about/cinema-about.webp"
          alt="An empty cinema auditorium facing the screen"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-black/60" aria-hidden />
        <div className="container-page pb-14 pt-32 text-white lg:pb-20">
          <h1 className="display max-w-4xl text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
            Sri Lankan films on Korean screens
          </h1>
          <p className="mt-8 max-w-xl text-lg text-white/90">
            AR Entertainment brings new Sinhala films to cinemas across South
            Korea, so the community here can watch them together, on the big
            screen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/movies" size="lg">
              See what&apos;s showing
            </LinkButton>
            <LinkButton href="/contact" size="lg" variant="onDark">
              Contact us
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Two cities, one evening: the live clocks show what time it is at home right now. */}
      <section className="container-page py-20 lg:py-32">
        <Reveal>
          <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
            From Colombo to Ansan
          </h2>
          <p className="mt-6 max-w-2xl text-lg">
            A 6:00 PM show in Ansan starts at 2:30 PM back home. We close that
            distance one screening at a time.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:gap-8">
          {cities.map((city, i) => (
            <Reveal key={city.name} delay={0.08 * (i + 1)}>
              <figure>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={city.image}
                    alt={city.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
                <figcaption className="mt-5">
                  <p className="display text-3xl">{city.name}</p>
                  <p className="mt-1 text-muted">{city.line}</p>
                  <div className="mt-4">
                    <CityClock timeZone={city.timeZone} offset={city.offset} />
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Who we are. */}
      <section className="bg-surface py-20 lg:py-32">
        <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-6">
            <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
              Run by Sri Lankans in Korea
            </h2>
            <p className="mt-8 text-2xl leading-snug sm:text-3xl">
              For Sri Lankans who live, work and study here, a premiere night
              means hearing our own language in a full cinema.
            </p>
          </Reveal>
          <Reveal className="lg:col-span-5 lg:col-start-8 lg:pt-3" delay={0.1}>
            <div className="space-y-5 text-lg">
              <p>
                AR Entertainment (엔터코리아 AR) is a film promoter based in
                South Korea, led by Anjana Ravinath. We bring new Sri Lankan
                releases to Korean cinemas and look after everything from the
                booking to the night itself.
              </p>
              <p>
                We work with cinemas such as CGV to host premieres and special
                screenings, with proper sound, proper seats and a room full of
                people from home. Recent shows include the Sinhala film “එදා රෑ”
                at CGV Ansan.
              </p>
              <p>
                Every ticket also helps Sri Lankan filmmakers reach an audience
                beyond the island.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How a premiere night works. */}
      <section className="container-page grid gap-12 py-20 lg:grid-cols-12 lg:py-32">
        <Reveal className="lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/images/about/intro-2.webp"
              alt="Striped paper bags of popcorn"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </Reveal>
        <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
          <Reveal>
            <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
              How a premiere night works
            </h2>
          </Reveal>
          <ol className="mt-10 space-y-8">
            {night.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={0.07 * (i + 1)}>
                  <h3 className="display text-2xl sm:text-3xl">{step.title}</h3>
                  <p className="mt-2 text-lg">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
          <Reveal delay={0.35}>
            <LinkButton href="/movies" size="lg" className="mt-10">
              Book a seat
            </LinkButton>
          </Reveal>
        </div>
      </section>

      {/* Close: a full field of the brand colour with every way to reach us. */}
      <section className="bg-accent py-20 text-on-accent lg:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
              Bring a film to your city
            </h2>
            <p className="mt-6 max-w-lg text-lg">
              Want a screening near you, tickets for a group, or to partner with
              us on a release? Talk to us.
            </p>
          </Reveal>
          <ContactChannels tone="accent" className="lg:col-span-6" />
        </div>
        <p className="container-page mt-16 text-sm opacity-80">
          Photos: “Colombo 02” by Bernard Gagnon,{" "}
          <a
            className="underline"
            href="https://creativecommons.org/licenses/by-sa/3.0/"
          >
            CC BY-SA 3.0
          </a>
          ; “Ansan fall 2014 06” by Piotrus,{" "}
          <a
            className="underline"
            href="https://creativecommons.org/licenses/by-sa/4.0/"
          >
            CC BY-SA 4.0
          </a>
          ; both via Wikimedia Commons.
        </p>
      </section>
    </>
  );
}
