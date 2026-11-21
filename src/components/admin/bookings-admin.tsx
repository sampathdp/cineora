"use client";

import { useState } from "react";
import { Check, Copy, Eye, Film, Sparkles, Ticket, User, XCircle } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, Feedback, PageTitle, Pager, Pill, Section, SelectField, TextField, useAction, useLoad, when, won } from "./kit";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/dialogs";

interface Booking {
  id: string;
  reference: string;
  status: string;
  total: number;
  discount: number;
  fee: number;
  subtotal: number;
  created_at: string;
  payment_deadline_at: string;
  seats: { label: string; category: string; unit_price: number }[];
  showtime: { id: string; starts_at: string; movie: string; cinema: string; room: string } | null;
  customer: { name: string; email: string } | null;
  payments?: { id: string; status: string; expected_amount: number; submitted_amount: number | null }[];
  history?: { from: string | null; to: string; reason: string | null; actor: string | null; at: string }[];
}

const STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_REVIEW",
  "PAYMENT_REJECTED",
  "CONFIRMED",
  "EXPIRED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "PAYMENT_EXCEPTION",
];

const tone = (s: string) =>
  (s === "CONFIRMED"
    ? "good"
    : s === "PAYMENT_EXCEPTION" || s === "REFUND_PENDING"
    ? "bad"
    : s === "EXPIRED" || s === "CANCELLED" || s === "REFUNDED"
    ? "neutral"
    : "warn") as "good" | "bad" | "neutral" | "warn";

export function BookingsAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(
    () => adm.get<Booking[]>("/bookings", { q, status, page, per_page: 20 }),
    `bk-${q}-${status}-${page}`,
  );

  return (
    <section className="space-y-6">
      <PageTitle
        title="Bookings & Orders"
        eyebrow="Commerce & Sales"
        icon={Ticket}
        hint="Search by ticket reservation reference. Customer email search requires privacy authorization."
      />

      <Feedback error={act.error} note={act.note} />

      {/* Modern Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex-1">
          <TextField
            id="bq"
            label="Search reference or customer"
            placeholder="Search booking code (e.g. BK-2026-X8Y9)…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-60">
          <SelectField
            id="bs"
            label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable
              rows={res.data}
              rowKey={(b) => b.id}
              onRowClick={(b) => setSelected(b.id)}
              empty="No bookings match your filter."
              columns={[
                {
                  key: "r",
                  label: "Booking Reference",
                  render: (b) => (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-foreground tracking-wider">
                        {b.reference}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "m",
                  label: "Movie & Screening",
                  render: (b) => (
                    <div>
                      <span className="font-bold text-foreground block">
                        {b.showtime?.movie ?? "—"}
                      </span>
                      {b.showtime && (
                        <span className="text-xs text-muted block mt-0.5">
                          {b.showtime.cinema} · {b.showtime.room}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "s",
                  label: "Seats",
                  render: (b) => (
                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                      {b.seats.map((s) => (
                        <span
                          key={s.label}
                          className="rounded-md border border-line/70 bg-surface/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground"
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "c",
                  label: "Customer",
                  render: (b) =>
                    b.customer ? (
                      <div>
                        <span className="font-semibold text-foreground block">{b.customer.name}</span>
                        <span className="text-xs text-muted block">{b.customer.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">Protected</span>
                    ),
                },
                {
                  key: "t",
                  label: "Total Amount",
                  render: (b) => (
                    <span className="font-extrabold text-accent text-sm">
                      {won(b.total)}
                    </span>
                  ),
                },
                {
                  key: "st",
                  label: "Status",
                  render: (b) => (
                    <Pill tone={tone(b.status)}>{b.status.replaceAll("_", " ").toLowerCase()}</Pill>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  render: (b) => (
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(b.id)}
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                      >
                        <Eye className="size-3.5 mr-1" />
                        <span>Inspect</span>
                      </Button>
                      {can("bookings.cancel") && (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if ((await confirmDialog({ title: `Cancel booking ${b.reference}?`, message: "The booking is cancelled and its seats go back on sale.", confirmLabel: "Cancel booking", cancelLabel: "Keep booking", danger: true }))) {
                              if (await act.run(() => adm.post(`/bookings/${b.id}/cancel`), "Cancelled.")) {
                                list.reload();
                              }
                            }
                          }}
                          className="h-8 px-2 text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <Pager
              page={Number(res.meta?.page ?? 1)}
              last={Number(res.meta?.last_page ?? 1)}
              onPage={setPage}
            />
          </>
        )}
      </Section>
      {selected ? (
        <Detail key={selected} id={selected} onClose={() => setSelected(null)} onChanged={list.reload} />
      ) : null}
    </section>
  );
}

function Detail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const act = useAction();
  const [copied, setCopied] = useState(false);
  const d = useLoad(() => adm.get<Booking>(`/bookings/${id}`).then((r) => r.data), `bk-${id}`);

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={`Booking: ${d.data?.reference ?? "…"}`}
      subtitle="Ticket reservation details, customer information, payments, and audit history"
      size="lg"
    >
      <Section loading={d.loading} error={d.error} data={d.data}>
        {(b) => (
          <div className="space-y-6">
            {/* Boarding pass ticket style header */}
            <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-br from-surface via-elevated to-surface p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/20">
                    <Ticket className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-extrabold tracking-wider text-foreground">
                        {b.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyRef(b.reference)}
                        className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground transition cursor-pointer"
                        title="Copy reference"
                      >
                        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                    <span className="text-xs text-muted">Created {when(b.created_at)}</span>
                  </div>
                </div>

                <Pill tone={tone(b.status)}>{b.status.replaceAll("_", " ").toLowerCase()}</Pill>
              </div>

              {b.showtime && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-muted uppercase font-bold text-[10px]">Movie</span>
                    <p className="text-sm font-extrabold text-foreground mt-0.5">{b.showtime.movie}</p>
                  </div>
                  <div>
                    <span className="text-muted uppercase font-bold text-[10px]">Auditorium & Showtime</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {b.showtime.cinema} · {b.showtime.room} · {when(b.showtime.starts_at)}
                    </p>
                  </div>
                </div>
              )}

              {b.customer && (
                <div className="mt-4 pt-3 border-t border-line/40 flex items-center gap-2 text-xs">
                  <User className="size-3.5 text-muted" />
                  <span className="font-semibold text-foreground">{b.customer.name}</span>
                  <span className="text-muted">({b.customer.email})</span>
                </div>
              )}
            </div>

            {/* Seats & Price Breakdown */}
            <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Reserved Seats & Pricing</h4>
              <ul className="divide-y divide-line/40 text-sm">
                {b.seats.map((s) => (
                  <li key={s.label} className="flex justify-between py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-bold text-accent rounded bg-accent/10 px-2 py-0.5 text-xs">
                        {s.label}
                      </span>
                      <span className="text-muted text-xs capitalize">{s.category} Tier</span>
                    </span>
                    <span className="font-semibold text-foreground">{won(s.unit_price)}</span>
                  </li>
                ))}
                {b.discount > 0 && (
                  <li className="flex justify-between py-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Promo Discount</span>
                    <span>-{won(b.discount)}</span>
                  </li>
                )}
                {b.fee > 0 && (
                  <li className="flex justify-between py-2 text-xs text-muted">
                    <span>Booking Fee</span>
                    <span>{won(b.fee)}</span>
                  </li>
                )}
                <li className="flex justify-between py-3 border-t border-line text-base font-extrabold text-foreground">
                  <span>Grand Total</span>
                  <span className="text-accent">{won(b.total)}</span>
                </li>
              </ul>
            </div>

            {/* Payment Transactions */}
            {b.payments && b.payments.length > 0 && (
              <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Payment Transaction Records</h4>
                <div className="grid gap-2 text-xs">
                  {b.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-line/60 bg-elevated/70 p-3"
                    >
                      <span className="capitalize font-semibold text-foreground">
                        Status: {p.status.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="font-mono font-bold text-accent">
                        {won(p.submitted_amount ?? p.expected_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit History Timeline */}
            {b.history && b.history.length > 0 && (
              <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Audit History</h4>
                <ul className="space-y-2 text-xs">
                  {b.history.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="size-2 rounded-full bg-accent mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">
                          {h.from ? <span className="text-muted">{h.from} → </span> : ""}
                          <strong className="font-bold text-foreground">{h.to}</strong>
                          {h.reason ? <span className="text-muted"> ({h.reason})</span> : ""}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5">
                          By {h.actor ?? "System"} · {when(h.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Feedback error={act.error} note={act.note} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              {can("bookings.cancel") && (b.status === "PENDING_PAYMENT" || b.status === "PAYMENT_REJECTED") ? (
                <Button
                  variant="secondary"
                  disabled={act.busy}
                  onClick={async () => {
                    if (
                      (await confirmDialog({ title: "Cancel this unpaid booking?", message: "Its held seats are released back into inventory.", confirmLabel: "Cancel booking", cancelLabel: "Keep booking", danger: true })) &&
                      (await act.run(() => adm.post(`/bookings/${id}/cancel`), "Cancelled."))
                    ) {
                      d.reload();
                      onChanged();
                    }
                  }}
                  className="text-rose-500 hover:bg-rose-500/10"
                >
                  Cancel Unpaid Booking
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} className="cursor-pointer ml-auto">
                Close
              </Button>
            </div>
          </div>
        )}
      </Section>
    </AdminModal>
  );
}
