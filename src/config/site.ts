/** Single place to rebrand the demo site. */
export const siteConfig = {
  name: "CINEORA",
  tagline: "Cinema, booked beautifully.",
  description:
    "Book cinema tickets online: pick your film, choose your seats and pay by bank transfer.",
  /** Set NEXT_PUBLIC_SITE_URL to enable canonical URLs / metadataBase. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  currency: "KRW",
  locale: "en-US",
  maxSeatsPerBooking: 8,
  /** Draft bookings older than this are treated as expired (ms). */
  bookingTtlMs: 30 * 60 * 1000,
  contact: {
    email: "hello@example.invalid",
    phone: "+00 000 000 0000",
    address: "100 Placeholder Avenue, Demo City",
  },
  /** Unmistakably fictional demo bank details. */
  demoBank: {
    bankName: "Demo Bank (Fictional)",
    accountName: "Cineora Demo Account",
    accountNumber: "0000 0000 0000",
    branch: "Sample Branch 000",
    swift: "DEMOXXXX",
  },
  socials: [
    { label: "Facebook", href: "#", icon: "facebook" },
    { label: "Instagram", href: "#", icon: "instagram" },
    { label: "Twitter / X", href: "#", icon: "twitter" },
    { label: "YouTube", href: "#", icon: "youtube" },
  ],
  nav: [
    { label: "Home", href: "/" },
    { label: "Movies", href: "/movies" },
    { label: "Events", href: "/events" },
    { label: "News", href: "/news" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
