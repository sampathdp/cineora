"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ChevronRight, Copy, Eye, Film, Mail, MapPin, Ticket, User, XCircle } from "lucide-react";
import { routes } from "@/lib/routes";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Feedback, PageTitle, Pager, Pill, Section, SelectField, TextField, useAction, useLoad, when, won } from "./kit";
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
  const router = useRouter();
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
              onRowClick={(b) => router.push(routes.adminBooking(b.id))}
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
                        onClick={() => router.push(routes.adminBooking(b.id))}
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
    </section>
  );
}

const STEP_LABEL = (s: string) => s.replaceAll("_", " ").toLowerCase();

/** /admin/bookings/view/?id=… : full-page booking record (customer, seats, payments, history, actions). */
export function BookingDetailPage() {
  const id = useSearchParams().get("id") ?? "";
  const { can } = useAuth();
  const act = useAction();
  const [copied, setCopied] = useState(false);
  const d = useLoad(
    (signal) =>
      id
        ? adm.get<Booking>(`/bookings/${encodeURIComponent(id)}`, undefined, signal).then((r) => r.data)
        : Promise.reject(new Error("No booking selected.")),
    `bk-${id}`,
    { cache: false },
  );

  const copyRef = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-6">
      <PageTitle
        title={d.data ? `Booking ${d.data.reference}` : "Booking"}
        eyebrow="Commerce & Sales"
        icon={Ticket}
        breadcrumbs={[{ label: "Bookings & Orders", href: "/admin/bookings/" }, { label: d.data?.reference ?? "Booking" }]}
        action={
          <Link
            href="/admin/bookings/"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent hover:text-accent-text"
          >
            <ArrowLeft className="size-4" aria-hidden /> All bookings
          </Link>
        }
      />

      <Section loading={d.loading} error={d.error} data={d.data}>
        {(b) => (
          <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
            {/* Main column */}
            <div className="min-w-0 space-y-6">
              <div className="rounded-2xl border border-line/80 bg-gradient-to-br from-surface via-elevated to-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/15 text-accent">
                      <Ticket className="size-6" aria-hidden />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xl font-extrabold tracking-wider">{b.reference}</span>
                        <button
                          type="button"
                          onClick={() => copyRef(b.reference)}
                          className="cursor-pointer rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground"
                          aria-label="Copy reference"
                        >
                          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                      <span className="text-xs text-muted">Created {when(b.created_at)}</span>
                    </div>
                  </div>
                  <Pill tone={tone(b.status)}>{STEP_LABEL(b.status)}</Pill>
                </div>

                {b.showtime && (
                  <dl className="mt-6 grid gap-4 border-t border-line/40 pt-5 sm:grid-cols-3">
                    <Fact icon={Film} label="Movie" value={b.showtime.movie} />
                    <Fact icon={MapPin} label="Cinema & hall" value={`${b.showtime.cinema} · ${b.showtime.room}`} />
                    <Fact icon={CalendarClock} label="Screening" value={when(b.showtime.starts_at)} />
                  </dl>
                )}
              </div>

              <div className="rounded-2xl border border-line/60 bg-elevated/60 p-6">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Seats & pricing</h2>
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr className="border-b border-line/60">
                      <th className="py-2 font-semibold">Seat</th>
                      <th className="py-2 font-semibold">Category</th>
                      <th className="py-2 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {b.seats.map((s) => (
                      <tr key={s.label}>
                        <td className="py-2.5">
                          <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-xs font-bold text-accent">{s.label}</span>
                        </td>
                        <td className="py-2.5 capitalize text-muted">{s.category}</td>
                        <td className="py-2.5 text-right font-semibold">{won(s.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line/60">
                      <td colSpan={2} className="pt-3 text-muted">
                        Subtotal
                      </td>
                      <td className="pt-3 text-right">{won(b.subtotal)}</td>
                    </tr>
                    {b.discount > 0 && (
                      <tr className="text-emerald-600 dark:text-emerald-400">
                        <td colSpan={2} className="pt-1.5">
                          Promo discount
                        </td>
                        <td className="pt-1.5 text-right">−{won(b.discount)}</td>
                      </tr>
                    )}
                    {b.fee > 0 && (
                      <tr className="text-muted">
                        <td colSpan={2} className="pt-1.5">
                          Booking fee
                        </td>
                        <td className="pt-1.5 text-right">{won(b.fee)}</td>
                      </tr>
                    )}
                    <tr className="text-base font-extrabold">
                      <td colSpan={2} className="pt-3">
                        Total
                      </td>
                      <td className="pt-3 text-right text-accent">{won(b.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {b.history && b.history.length > 0 && (
                <div className="rounded-2xl border border-line/60 bg-elevated/60 p-6">
                  <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">History</h2>
                  <ol className="space-y-5 border-l border-line/70 pl-5">
                    {b.history.map((h, i) => (
                      <li key={i} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-elevated",
                            i === b.history!.length - 1 ? "bg-accent" : "bg-line",
                          )}
                        />
                        <p className="text-sm">
                          {h.from ? <span className="text-muted">{STEP_LABEL(h.from)} → </span> : null}
                          <strong className="capitalize">{STEP_LABEL(h.to)}</strong>
                        </p>
                        {h.reason ? <p className="text-sm text-muted">{h.reason}</p> : null}
                        <p className="mt-0.5 text-xs text-muted">
                          {h.actor ?? "System"} · {when(h.at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Side column */}
            <aside className="space-y-6">
              <div className="rounded-2xl border border-line/60 bg-elevated/60 p-5">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Customer</h2>
                {b.customer ? (
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                      <User className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{b.customer.name}</p>
                      <a href={`mailto:${b.customer.email}`} className="flex items-center gap-1 truncate text-xs text-muted hover:text-accent-text">
                        <Mail className="size-3" aria-hidden /> {b.customer.email}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Hidden. You need permission to view customer details.</p>
                )}
              </div>

              <div className="rounded-2xl border border-line/60 bg-elevated/60 p-5">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Payment</h2>
                <p className="flex justify-between gap-3 text-sm">
                  <span className="text-muted">Pay by</span>
                  <span className="font-semibold">{when(b.payment_deadline_at)}</span>
                </p>
                {b.payments && b.payments.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {b.payments.map((p) => (
                      <li key={p.id} className="rounded-xl border border-line/60 bg-surface/50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold capitalize">{STEP_LABEL(p.status)}</span>
                          <span className="font-bold text-accent">{won(p.submitted_amount ?? p.expected_amount)}</span>
                        </div>
                        {p.submitted_amount !== null && p.submitted_amount !== p.expected_amount ? (
                          <p className="mt-1 text-xs text-rose-500">Due {won(p.expected_amount)}. The amount differs.</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">No payment recorded yet.</p>
                )}
                {b.status === "PAYMENT_REVIEW" || b.status === "PAYMENT_EXCEPTION" ? (
                  <Link href="/admin/payments/" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:underline">
                    Open payments queue <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </div>

              <Feedback error={act.error} note={act.note} />

              {can("bookings.cancel") && (b.status === "PENDING_PAYMENT" || b.status === "PAYMENT_REJECTED" || b.status === "CONFIRMED") ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-rose-500">Cancel booking</h2>
                  <p className="mt-1 text-sm text-muted">Cancelling puts the seats back on sale.</p>
                  <Button
                    variant="secondary"
                    disabled={act.busy}
                    className="mt-3 w-full text-rose-500 hover:border-rose-500 hover:text-rose-500"
                    onClick={async () => {
                      if (
                        (await confirmDialog({
                          title: `Cancel booking ${b.reference}?`,
                          message: "Its seats go back on sale. This cannot be undone.",
                          confirmLabel: "Cancel booking",
                          cancelLabel: "Keep booking",
                          danger: true,
                        })) &&
                        (await act.run(() => adm.post(`/bookings/${encodeURIComponent(b.id)}/cancel`), "Booking cancelled."))
                      ) {
                        d.reload();
                      }
                    }}
                  >
                    <XCircle className="size-4" aria-hidden /> Cancel booking
                  </Button>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </Section>
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</dt>
        <dd className="mt-0.5 truncate font-semibold">{value}</dd>
      </div>
    </div>
  );
}
