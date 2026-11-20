/** Single place to rebrand the demo site. */
export const siteConfig = {
  name: "AR ENTERTAINMENT",
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
  /** Fallbacks only: the live values come from the admin site settings. */
  contact: {
    email: "arentertainmentkr@gmail.com",
    phone: "+82 10-4828-7461",
    address: "Ansan, Gyeonggi-do, South Korea",
  },
  whatsapp: { label: "+82 10-4393-7461", href: "https://wa.me/821043937461" },
  /** Unmistakably fictional demo bank details. */
  demoBank: {
    bankName: "Demo Bank (Fictional)",
    accountName: "AR Entertainment Demo Account",
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
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
