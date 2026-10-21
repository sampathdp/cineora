import type { Screen } from "@/types/cinema";
import type { Seat, SeatCategory } from "@/types/booking";
import { hashString, seededRandom } from "./utils";

export const BASE_PRICES: Record<SeatCategory, number> = {
  standard: 12,
  premium: 16,
  lounge: 22,
};

export const CATEGORY_LABEL: Record<SeatCategory, string> = {
  standard: "Standard",
  premium: "Premium",
  lounge: "Lounge",
};

const rowLetter = (i: number) => String.fromCharCode(65 + i);

/**
 * Builds a screen's seat grid. Unavailable seats are deterministic mock state
 * derived from the showtime id — no real reservation exists.
 */
export function buildSeats(screen: Screen, showtimeId: string): Seat[][] {
  const rand = seededRandom(hashString(showtimeId));
  return Array.from({ length: screen.rows }, (_, r) => {
    const category: SeatCategory =
      r === screen.rows - 1 ? "lounge" : r >= Math.floor(screen.rows / 3) && r < screen.rows - 2 ? "premium" : "standard";
    return Array.from({ length: screen.seatsPerRow }, (_, n) => {
      const row = rowLetter(r);
      return {
        id: `${row}${n + 1}`,
        row,
        number: n + 1,
        category,
        price: Math.round(BASE_PRICES[category] * screen.priceMultiplier * 100) / 100,
        unavailable: rand() < 0.22,
      };
    });
  });
}
