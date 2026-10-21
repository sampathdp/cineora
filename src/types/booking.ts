export type SeatCategory = "standard" | "premium" | "lounge";

export interface Seat {
  id: string;
  row: string;
  number: number;
  category: SeatCategory;
  price: number;
  unavailable: boolean;
}

export interface CustomerDetails {
  fullName: string;
  email: string;
  phone: string;
}

export interface BookingDraft {
  showtimeId: string;
  dateISO: string;
  seatIds: string[];
  createdAt: number;
}

export interface DemoBooking extends BookingDraft {
  reference: string;
  customer: CustomerDetails;
  paymentReference: string;
  proofFileName?: string;
  total: number;
  confirmedAt: number;
}
