import { api, apiBlob, apiDelete, apiGet, apiPatch, apiPost, type ApiEnvelope } from "./client";
import type { PaymentStatus } from "./payments";

export interface AdminPayment {
  id: string;
  status: PaymentStatus;
  payment_reference: string;
  expected_amount: number;
  submitted_amount: number | null;
  amount_matches: boolean;
  transfer_date: string | null;
  payer_name: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  exception_at: string | null;
  currency: string;
  booking: {
    id: string;
    reference: string;
    status: string;
    seats: string[];
    payment_deadline_at: string;
    movie: string | null;
    cinema: string | null;
    starts_at: string | null;
  };
  /** Only present for staff who hold the "view customer details" permission. */
  customer: { name: string; email: string } | null;
  bank_account: { bank_name: string; account_name: string } | null;
  proofs: { id: number; mime: string; size: number; uploaded_at: string | null }[];
  reviews: { decision: string; reason: string | null; notes: string | null; reviewer: string | null; at: string | null }[];
}

export interface AdminRefund {
  id: string;
  status: "pending" | "approved" | "denied" | "paid";
  amount: number;
  reason: string;
  created_at: string | null;
  booking: { id: string; reference: string; status: string; movie: string | null };
}

export interface AdminBankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  swift: string | null;
  instructions: string | null;
  is_active: boolean;
  cinema: { id: string; name: string } | null;
}

export type ScanResult = {
  result: "valid" | "already_used" | "cancelled" | "refunded" | "wrong_showtime" | "invalid" | "void";
  message: string;
  ticket?: { reference: string; seat: string; category: string; movie: string; starts_at: string; room: string; checked_in_at: string | null };
};

const enc = encodeURIComponent;

export const adminApi = {
  payments: (queue: "pending" | "exceptions" | "all") =>
    apiGet<AdminPayment[]>("/admin/payments", { query: { queue: queue === "all" ? undefined : queue, per_page: 50 } }).then((r) => r.data),
  payment: (id: string) => apiGet<AdminPayment>(`/admin/payments/${enc(id)}`).then((r) => r.data),
  proofBlob: (paymentId: string, proofId: number, signal?: AbortSignal) => apiBlob(`/admin/payments/${enc(paymentId)}/proofs/${proofId}`, signal),
  verify: (id: string, notes?: string) => apiPost<AdminPayment>(`/admin/payments/${enc(id)}/verify`, { notes }).then((r) => r.data),
  reject: (id: string, reason: string, notes?: string) => apiPost<AdminPayment>(`/admin/payments/${enc(id)}/reject`, { reason, notes }).then((r) => r.data),
  toException: (id: string, reason: string) => apiPost<AdminPayment>(`/admin/payments/${enc(id)}/exception`, { reason }).then((r) => r.data),
  resolve: (id: string, input: { action: "confirm" | "cancel"; note: string; acknowledge_amount_difference?: boolean }) =>
    apiPost<AdminPayment>(`/admin/payments/${enc(id)}/resolve`, input).then((r) => r.data),

  refunds: (status = "pending") => apiGet<AdminRefund[]>("/admin/refunds", { query: { status } }).then((r) => r.data),
  denyRefund: (id: string, reason: string) => apiPost<AdminRefund>(`/admin/refunds/${enc(id)}/deny`, { reason }).then((r) => r.data),
  payRefund: (id: string, reference: string) => apiPost<AdminRefund>(`/admin/refunds/${enc(id)}/pay`, { reference }).then((r) => r.data),

  bankAccounts: () => apiGet<AdminBankAccount[]>("/admin/bank-accounts").then((r) => r.data),
  addBankAccount: (input: { bank_name: string; account_name: string; account_number: string; branch?: string; swift?: string; instructions?: string }) =>
    apiPost<AdminBankAccount>("/admin/bank-accounts", input).then((r) => r.data),
  updateBankAccount: (id: string, input: Partial<{ is_active: boolean }>) => apiPatch<AdminBankAccount>(`/admin/bank-accounts/${enc(id)}`, input).then((r) => r.data),

  validateTicket: (input: { code?: string; reference?: string; showtime?: string }) => apiPost<ScanResult>("/admin/tickets/validate", input).then((r) => r.data),
  recentScans: () => apiGet<{ outcome: string; seat: string | null; at: string | null }[]>("/admin/tickets/recent").then((r) => r.data),

  /** Pair a phone as the scanner camera; the phone posts scans with the token, the desktop polls for results. */
  createScannerPair: () => apiPost<{ token: string; expires_at: string }>("/admin/scanner/pairs").then((r) => r.data),
  scannerPairEvents: (token: string, after: number) =>
    apiGet<{ connected: boolean; events: { seq: number; result: ScanResult }[] }>(`/admin/scanner/pairs/${enc(token)}/events`, { query: { after } }).then((r) => r.data),
  endScannerPair: (token: string) => apiDelete<null>(`/admin/scanner/pairs/${enc(token)}`),
};

type Query = Record<string, string | number | boolean | undefined | null>;

/** Thin, typed access to any `/admin/...` endpoint. Pages decide their own response shapes. */
export const adm = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal): Promise<ApiEnvelope<T>> => apiGet<T>(`/admin${path}`, { query, signal }),
  post: <T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> => apiPost<T>(`/admin${path}`, body),
  patch: <T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> => apiPatch<T>(`/admin${path}`, body),
  put: <T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> => api<T>(`/admin${path}`, { method: "PUT", body: body ?? {} }),
  del: <T>(path: string): Promise<ApiEnvelope<T>> => apiDelete<T>(`/admin${path}`),
  upload: <T>(path: string, file: File, field = "image", extra: Record<string, string> = {}): Promise<ApiEnvelope<T>> => {
    const form = new FormData();
    form.set(field, file);
    for (const [k, v] of Object.entries(extra)) form.set(k, v);
    return apiPost<T>(`/admin${path}`, form);
  },
};
