"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useSite } from "@/lib/use-site";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";

/** lucide-react no longer ships brand icons, so these are minimal inline glyphs. */
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "size-4",
} as const;

const socialIcons = {
  facebook: () => (
    <svg {...svg}>
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3H9v9h3v-9h2.5l.5-3H12V6.5a.5.5 0 0 1 .5-.5H15z" />
    </svg>
  ),
  instagram: () => (
    <svg {...svg}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  twitter: () => (
    <svg {...svg}>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  ),
  youtube: () => (
    <svg {...svg}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" />
    </svg>
  ),
} as const;

const movieLinks = [
  { label: "Now Playing", href: "/movies" },
  { label: "Coming Soon", href: "/movies?tab=coming-soon" },
];

export function Footer() {
  const { site } = useSite();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-sm text-muted">{site.description}</p>
            <ul className="mt-6 flex flex-col gap-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-accent-text" aria-hidden /> {site.contact.address}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-accent-text" aria-hidden /> {site.contact.phone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-accent-text" aria-hidden /> {site.contact.email}
              </li>
            </ul>
          </div>

          <nav aria-label="Footer" className="grid min-w-0 grid-cols-2 gap-6 sm:grid-cols-2 lg:col-span-5">
            <FooterColumn title="Explore" links={siteConfig.nav.map((n) => ({ label: n.label, href: n.href }))} />
            <FooterColumn title="Movies" links={movieLinks} />
          </nav>

          <div className="lg:col-span-3">
            <h2 className="display text-xl">Newsletter</h2>
            <p className="mb-4 mt-2 text-sm text-muted">Premieres, special screenings and offers, in your inbox.</p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <ul className="flex gap-2">
              {site.socials.filter((s) => s.platform in socialIcons).map((s) => {
                const Icon = socialIcons[s.platform as keyof typeof socialIcons];
                return (
                  <li key={s.platform}>
                    <a
                      href={s.url}
                      aria-label={`${s.platform[0].toUpperCase()}${s.platform.slice(1)} (opens in a new tab)`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-9 place-items-center rounded-full border border-line transition hover:border-accent hover:bg-accent hover:text-on-accent"
                    >
                      <Icon />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="display text-xl">{title}</h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm text-muted">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="transition hover:text-accent-text">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
