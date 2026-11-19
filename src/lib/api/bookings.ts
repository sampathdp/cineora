import { apiGet, apiPost } from "./client";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_REVIEW"
  | "PAYMENT_REJECTED"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "PAYMENT_EXCEPTION";

export interface ApiBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  currency: string;
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  hold_expires_at: string;
  payment_deadline_at: string;
  created_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  seats: { label: string; category: string; unit_price: number }[];
  showtime?: {
    id: string;
    starts_at: string;
    movie: { slug: string; title: string };
    cinema: { name: string; timezone: string };
    room: { name: string };
  };
}

/** Everything the server needs to create a booking. No prices or totals: the server calculates those. */
export interface CreateBookingInput {
  showtime: string;
  seats: string[];
  promo_code?: string;
}

export const bookingsApi = {
  /** `idempotencyKey` makes retries safe: the same key never creates a second booking. */
  create: (input: CreateBookingInput, idempotencyKey: string) =>
    apiPost<ApiBooking>("/bookings", input, { idempotencyKey }).then((r) => ({ booking: r.data, replayed: r.meta?.replayed === true, serverNow: String(r.meta?.server_now ?? "") })),
  list: () => apiGet<ApiBooking[]>("/bookings", { query: { per_page: 50 } }).then((r) => ({ bookings: r.data, serverNow: String(r.meta?.server_now ?? "") })),
  get: (id: string) => apiGet<ApiBooking>(`/bookings/${encodeURIComponent(id)}`).then((r) => ({ booking: r.data, serverNow: String(r.meta?.server_now ?? "") })),
  cancel: (id: string) => apiPost<ApiBooking>(`/bookings/${encodeURIComponent(id)}/cancel`).then((r) => r.data),
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_REVIEW: "Payment under review",
  PAYMENT_REJECTED: "Payment rejected",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  PAYMENT_EXCEPTION: "Needs attention",
};
