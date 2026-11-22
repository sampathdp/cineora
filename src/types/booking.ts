/** Category key from the API (e.g. "standard", "premium", "lounge"); the set is data, not code. */
export type SeatCategory = string;

export interface Seat {
  id: string;
  row: string;
  number: number;
  /** Horizontal grid column. Equals `number` unless the room has walkway gaps, which shift columns but never renumber seats. */
  col: number;
  /** Vertical grid line of the row. Jumps by more than one where the room has a horizontal walkway before this row. */
  line?: number;
  category: SeatCategory;
  categoryName: string;
  /** Server-calculated price in whole won. Display only; the server prices the booking. */
  price: number;
  unavailable: boolean;
}

export interface BookingDraft {
  showtimeId: string;
  dateISO: string;
  seatIds: string[];
  createdAt: number;
  /** Sent as the Idempotency-Key header, so a retried checkout cannot create a second booking. */
  idempotencyKey: string;
}
