import type { Testimonial } from "@/types/article";

/** Fictional demo profiles. These are NOT real customer reviews. */
export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Demo Customer A",
    title: "Fictional profile",
    quote:
      "Choosing seats felt effortless and the whole flow was clear from start to finish. This is illustrative demo copy.",
    rating: 5,
    initials: "DA",
    tone: "#f0782b",
  },
  {
    id: "t2",
    name: "Demo Customer B",
    title: "Fictional profile",
    quote:
      "The seat map is easy to read even on a phone. A sample testimonial written for the prototype.",
    rating: 5,
    initials: "DB",
    tone: "#2b4a63",
  },
  {
    id: "t3",
    name: "Demo Customer C",
    title: "Fictional profile",
    quote:
      "Showtimes and seat selection in one place, which is just what a good cinema site should do. Demo content.",
    rating: 4,
    initials: "DC",
    tone: "#6b3b8f",
  },
];
