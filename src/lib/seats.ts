import type { Seat } from "@/types/booking";
import type { ApiSeat } from "@/lib/api/catalog";

/** Groups the flat API seat list into rows (A, B, C…) ordered by seat number. */
export function groupSeats(apiSeats: ApiSeat[]): Seat[][] {
  const rows = new Map<string, Seat[]>();
  for (const s of apiSeats) {
    const seat: Seat = {
      id: s.key,
      row: s.row_label,
      number: s.number,
      col: s.x ?? s.number,
      line: s.y ?? undefined,
      category: s.category_key,
      categoryName: s.category_name,
      price: s.price,
      // held / sold / blocked / inactive all mean "cannot be picked right now"
      unavailable: s.status !== "available",
    };
    rows.set(s.row_label, [...(rows.get(s.row_label) ?? []), seat]);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, seats]) => seats.sort((x, y) => x.number - y.number));
}
