import { apiGet, apiPost } from "./client";

export type PaymentStatus =
  | "AWAITING_TRANSFER"
  | "PROOF_SUBMITTED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "EXCEPTION"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

/** Customer view of their own payment. */
export interface PaymentInfo {
  id: string;
  status: PaymentStatus;
  transfer_memo: string;
  expected_amount: number;
  submitted_amount: number | null;
  transfer_date: string | null;
  currency: string;
  bank: { bank_name: string; account_name: string; account_number: string; branch: string | null; swift: string | null; instructions: string | null };
  rejection_reason: string | null;
  proofs: { id: number; mime: string; size: number; uploaded_at: string | null }[];
}

export interface TicketInfo {
  id: string;
  reference: string;
  status: "valid" | "used" | "cancelled" | "refunded" | "void";
  seat: string;
  category: string;
  booking: { id: string; reference: string };
  movie: { slug: string; title: string };
  cinema: { name: string; timezone: string };
  room: string;
  starts_at: string;
  used_at: string | null;
  /** What the QR code encodes. Present only for the owner and only while the ticket can be shown. */
  qr: string | null;
}

export const paymentsApi = {
  get: (bookingId: string) => apiGet<PaymentInfo | null>(`/bookings/${encodeURIComponent(bookingId)}/payment`).then((r) => r.data),
  submitProof: (bookingId: string, input: { proof: File; submitted_amount: number; transfer_date: string; payer_name?: string }) => {
    const form = new FormData();
    form.set("proof", input.proof);
    form.set("submitted_amount", String(input.submitted_amount));
    form.set("transfer_date", input.transfer_date);
    if (input.payer_name) form.set("payer_name", input.payer_name);
    return apiPost<PaymentInfo>(`/bookings/${encodeURIComponent(bookingId)}/payment/proof`, form).then((r) => r.data);
  },
  tickets: (bookingId: string) => apiGet<TicketInfo[]>(`/bookings/${encodeURIComponent(bookingId)}/tickets`).then((r) => r.data),
  myTickets: () => apiGet<TicketInfo[]>("/tickets").then((r) => r.data),
};
