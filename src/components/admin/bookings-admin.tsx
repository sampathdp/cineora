"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, Feedback, PageTitle, Panel, Pager, Pill, Section, SelectField, TextField, useAction, useLoad, when, won } from "./kit";

interface Booking {
  id: string; reference: string; status: string; total: number; discount: number; fee: number; subtotal: number; created_at: string; payment_deadline_at: string;
  seats: { label: string; category: string; unit_price: number }[];
  showtime: { id: string; starts_at: string; movie: string; cinema: string; room: string } | null;
  customer: { name: string; email: string } | null;
  payments?: { id: string; status: string; expected_amount: number; submitted_amount: number | null }[];
  history?: { from: string | null; to: string; reason: string | null; actor: string | null; at: string }[];
}

const STATUSES = ["PENDING_PAYMENT", "PAYMENT_REVIEW", "PAYMENT_REJECTED", "CONFIRMED", "EXPIRED", "CANCELLED", "REFUND_PENDING", "REFUNDED", "PAYMENT_EXCEPTION"];
const tone = (s: string) => (s === "CONFIRMED" ? "good" : s === "PAYMENT_EXCEPTION" || s === "REFUND_PENDING" ? "bad" : s === "EXPIRED" || s === "CANCELLED" || s === "REFUNDED" ? "neutral" : "warn") as "good" | "bad" | "neutral" | "warn";

export function BookingsAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => adm.get<Booking[]>("/bookings", { q, status, page, per_page: 20 }), `bk-${q}-${status}-${page}`);

  return (
    <section>
      <PageTitle
        title="Bookings & Reservations"
        eyebrow="Commerce & Sales"
        hint="Search by booking reference. Customer email search requires extra data privacy permissions."
      />
      <Feedback error={act.error} note={act.note} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <TextField id="bq" label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <SelectField id="bs" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLowerCase()}</option>)}
        </SelectField>
      </div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable rows={res.data} rowKey={(b) => b.id} onRowClick={(b) => setSelected(b.id)} empty="No bookings match."
              columns={[
                { key: "r", label: "Reference", render: (b) => <span className="font-mono font-bold">{b.reference}</span> },
                { key: "m", label: "Movie", render: (b) => b.showtime?.movie ?? "—" },
                { key: "s", label: "Seats", render: (b) => b.seats.map((s) => s.label).join(", ") },
                { key: "c", label: "Customer", render: (b) => b.customer ? <span>{b.customer.name}<span className="block text-xs text-muted">{b.customer.email}</span></span> : <span className="text-muted">hidden</span> },
                { key: "t", label: "Total", render: (b) => won(b.total) },
                { key: "st", label: "Status", render: (b) => <Pill tone={tone(b.status)}>{b.status.replaceAll("_", " ").toLowerCase()}</Pill> },
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
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="size-3.5 mr-1" />
                        <span>View</span>
                      </Button>
                      {can("bookings.cancel") && (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (window.confirm(`Cancel booking "${b.reference}"?`)) {
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
              ]} />
            <Pager page={Number(res.meta?.page ?? 1)} last={Number(res.meta?.last_page ?? 1)} onPage={setPage} />
          </>
        )}
      </Section>
      {selected ? <Detail key={selected} id={selected} onClose={() => setSelected(null)} onChanged={list.reload} /> : null}
    </section>
  );
}

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const act = useAction();
  const d = useLoad(() => adm.get<Booking>(`/bookings/${id}`).then((r) => r.data), `bk-${id}`);

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
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3"><h3 className="display font-mono text-3xl">{b.reference}</h3><Pill tone={tone(b.status)}>{b.status.replaceAll("_", " ").toLowerCase()}</Pill></div>
            <p className="text-muted">{b.showtime ? `${b.showtime.movie} · ${b.showtime.cinema} · ${b.showtime.room} · ${when(b.showtime.starts_at)}` : ""}</p>
            {b.customer ? <p>{b.customer.name} · {b.customer.email}</p> : null}
            <ul className="divide-y divide-line text-sm">
              {b.seats.map((s) => <li key={s.label} className="flex justify-between py-1.5"><span>Seat <strong>{s.label}</strong> · {s.category}</span><span>{won(s.unit_price)}</span></li>)}
              <li className="flex justify-between py-1.5 font-bold"><span>Total{b.discount ? ` (discount ${won(b.discount)})` : ""}</span><span>{won(b.total)}</span></li>
            </ul>
            {b.payments?.length ? <p className="text-sm text-muted">Payments: {b.payments.map((p) => `${p.status.toLowerCase().replaceAll("_", " ")} (${won(p.submitted_amount ?? p.expected_amount)})`).join(", ")}</p> : null}
            <div>
              <h4 className="font-semibold">History</h4>
              <ul className="mt-1 divide-y divide-line text-sm">
                {b.history?.map((h, i) => <li key={i} className="py-1.5">{h.from ?? "created"} → <strong>{h.to}</strong> <span className="text-muted">· {h.actor ?? "system"} · {when(h.at)}{h.reason ? ` · ${h.reason}` : ""}</span></li>)}
              </ul>
            </div>
            <Feedback error={act.error} note={act.note} />
            <div className="flex flex-wrap gap-3">
              {can("bookings.cancel") && (b.status === "PENDING_PAYMENT" || b.status === "PAYMENT_REJECTED") ? (
                <Button variant="secondary" disabled={act.busy} onClick={async () => { if (window.confirm("Cancel this unpaid booking and release the seats?") && (await act.run(() => adm.post(`/bookings/${id}/cancel`), "Cancelled."))) { d.reload(); onChanged(); } }}>Cancel booking</Button>
              ) : null}
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
            <p className="text-xs text-muted">Paid bookings are cancelled through the refund workflow, not here.</p>
          </div>
        )}
      </Section>
    </AdminModal>
  );
}
