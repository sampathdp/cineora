import type { Cinema } from "@/types/cinema";

/** Single venue with a single hall. Name, address and contact details are placeholders. */
export const cinemas: Cinema[] = [
  {
    slug: "cineora",
    name: "Cineora",
    area: "Downtown",
    address: "100 Placeholder Avenue, Demo City",
    phone: "+00 000 000 0001",
    email: "hello@example.invalid",
    description: "One hall, one screen, every film given the full treatment.",
    facilities: ["Step-free Access", "Parking"],
    screens: [
      { id: "c1", name: "Main Hall", type: "Standard", rows: 10, seatsPerRow: 14, priceMultiplier: 1 },
    ],
    art: {
      from: "#3a1a08",
      to: "#07060a",
      accent: "#f0782b",
      motif: "city",
    },
  },
];

export const getCinema = (slug: string) => cinemas.find((c) => c.slug === slug);
