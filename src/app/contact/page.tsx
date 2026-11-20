import type { Metadata } from "next";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { ContactForm } from "@/components/layout/contact-form";
import { ContactChannels } from "@/components/contact/contact-channels";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Call, WhatsApp or write to AR Entertainment about screenings, group tickets and partnerships.",
  openGraph: { title: "Contact | AR ENTERTAINMENT" },
};

const VENUE = {
  name: "CGV Ansan",
  address: "경기 안산시 단원구 광덕대로 194, NC안산고잔점",
  map: "https://map.naver.com/p/search/CGV%20%EC%95%88%EC%82%B0",
};

const faqs = [
  {
    q: "How do I pay for tickets?",
    a: "By bank transfer. After you book, send the amount to the account shown at checkout. We check the payment and confirm your booking.",
  },
  {
    q: "When do I get my tickets?",
    a: "As soon as your payment is confirmed. We email you, and one QR ticket per seat appears in your account.",
  },
  {
    q: "Can I book for a group?",
    a: "Yes. For a large group, call or WhatsApp us first and we will hold seats together.",
  },
  {
    q: "Where are the screenings?",
    a: "At partner cinemas such as CGV Ansan. The exact cinema and hall are on every showtime.",
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Talk to us: the quickest ways first, the form beside them. */}
      <section className="container-page grid gap-14 pb-20 pt-32 lg:grid-cols-12 lg:gap-16 lg:pb-32 lg:pt-40">
        <div className="lg:col-span-5">
          <h1 className="display text-5xl leading-[0.95] sm:text-7xl">
            Talk to us
          </h1>
          <p className="mt-8 max-w-md text-lg">
            Questions about a screening, tickets for a group, or bringing a film
            to your city? The fastest way is a call or a WhatsApp message.
          </p>
          <ContactChannels className="mt-10" />
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-card bg-surface p-6 sm:p-10">
            <h2 className="display text-3xl sm:text-4xl">Send us a message</h2>
            <p className="mb-8 mt-2 text-muted">
              We read every message and reply by email.
            </p>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Where we screen. */}
      <section className="bg-surface">
        <div className="grid lg:grid-cols-2">
          <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[32rem]">
            <Image
              src="/images/about/cinema-about.webp"
              alt="A cinema auditorium facing the screen"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center px-4 py-16 sm:px-10 lg:px-16">
            <Reveal>
              <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
                Where we screen
              </h2>
              <p className="mt-6 max-w-md text-lg">
                Most of our premieres are at {VENUE.name}. Each showtime lists
                its cinema and hall, so check your ticket before you set off.
              </p>
              <a
                href={VENUE.map}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-8 flex max-w-md items-start gap-4 rounded-control outline-offset-4"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-transform group-hover:scale-110">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xl font-semibold">
                    {VENUE.name}
                  </span>
                  <span className="mt-1 block">{VENUE.address}</span>
                  <span className="mt-2 block font-semibold text-accent-text underline-offset-4 group-hover:underline">
                    Open in Naver Map
                  </span>
                </span>
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Before you ask. */}
      <section className="container-page grid gap-12 py-20 lg:grid-cols-12 lg:py-32">
        <Reveal className="lg:col-span-4">
          <h2 className="display text-4xl sm:text-5xl lg:text-6xl">
            Before you ask
          </h2>
          <p className="mt-6 text-lg">The questions we hear most, answered.</p>
        </Reveal>
        <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:col-span-8">
          {faqs.map(({ q, a }, i) => (
            <Reveal key={q} delay={0.06 * (i + 1)}>
              <dt className="display text-2xl sm:text-3xl">{q}</dt>
              <dd className="mt-3 text-lg">{a}</dd>
            </Reveal>
          ))}
        </dl>
      </section>
    </>
  );
}
