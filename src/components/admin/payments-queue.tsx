"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { adminApi, type AdminPayment } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
import { confirmDialog } from "@/components/ui/dialogs";
import { AdminModal, DataTable, PageTitle, Pill } from "./kit";
import { cn } from "@/lib/utils";

type Queue = "pending" | "exceptions" | "all";
const TABS: { key: Queue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pending", label: "Awaiting review", icon: Clock },
  { key: "exceptions", label: "Exceptions", icon: AlertTriangle },
  { key: "all", label: "All records", icon: Banknote },
];

type Status = AdminPayment["status"];
const STATUS: Partial<Record<Status, { label: string; tone: "good" | "bad" | "warn" | "neutral" }>> = {
  AWAITING_TRANSFER: { label: "Awaiting transfer", tone: "neutral" },
  PROOF_SUBMITTED: { label: "Proof submitted", tone: "warn" },
  UNDER_REVIEW: { label: "Under review", tone: "warn" },
  VERIFIED: { label: "Verified", tone: "good" },
  REJECTED: { label: "Rejected", tone: "bad" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  EXCEPTION: { label: "Exception", tone: "bad" },
  REFUND_PENDING: { label: "Refund pending", tone: "warn" },
  PARTIALLY_REFUNDED: { label: "Partly refunded", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};
const statusOf = (s: Status) => STATUS[s] ?? { label: s.replaceAll("_", " ").toLowerCase(), tone: "neutral" as const };

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(iso)) : "—";

function ago(iso: string | null, now: number) {
  if (!iso || !now) return null;
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

const mismatch = (p: AdminPayment) => p.submitted_amount !== null && !p.amount_matches;

export function PaymentsQueue() {
  const [queue, setQueue] = useState<Queue>("pending");
  const [list, setList] = useState<{ queue: Queue; items?: AdminPayment[]; error?: string; at: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    adminApi
      .payments(queue)
      .then((items) => live && setList({ queue, items, at: Date.now() }))
      .catch(() => live && setList({ queue, error: "Could not load the queue.", at: Date.now() }));
    return () => {
      live = false;
    };
  }, [queue, nonce]);

  const loaded = list?.queue === queue ? list : null;
  const selected = loaded?.items?.find((p) => p.id === selectedId) ?? null;

  const rows = useMemo(() => {
    const items = loaded?.items ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) =>
      [p.booking.reference, p.payment_reference, p.payer_name, p.customer?.name, p.customer?.email, p.booking.movie]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [loaded, q]);

  const summary = useMemo(() => {
    const items = loaded?.items ?? [];
    return {
      count: items.length,
      total: items.reduce((s, p) => s + (p.submitted_amount ?? 0), 0),
      mismatched: items.filter(mismatch).length,
    };
  }, [loaded]);

  const done = useCallback((message: string) => {
    setNotice(message);
    setSelectedId(null);
    setNonce((n) => n + 1);
  }, []);

  return (
    <section className="space-y-6">
      <PageTitle
        title="Payments Verification Queue"
        eyebrow="Finance & Settlements"
        icon={Banknote}
        hint="Check each customer's bank transfer slip against the amount due, then verify to issue tickets."
      />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="cursor-pointer rounded-lg p-1 hover:bg-emerald-500/15">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Toolbar: queue tabs, search, refresh */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Queue" className="inline-flex self-start rounded-2xl border border-line/70 bg-surface/70 p-1.5">
          {TABS.map((t) => {
            const active = queue === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setQueue(t.key);
                  setSelectedId(null);
                  setNotice(null);
                }}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold transition",
                  active ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
                {active && loaded?.items ? (
                  <span className={cn("rounded-full px-1.5 py-px text-[10px]", active ? "bg-black/20" : "bg-surface")}>{loaded.items.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference, customer, sender…"
              aria-label="Search payments"
              className="h-10 w-full rounded-xl border border-line/70 bg-elevated pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setNonce((n) => n + 1)} aria-label="Refresh" className="h-10 cursor-pointer">
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      {loaded?.items && loaded.items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="In this queue" value={String(summary.count)} />
          <Summary label="Transferred (claimed)" value={formatPrice(summary.total)} />
          <Summary label="Amount mismatches" value={String(summary.mismatched)} bad={summary.mismatched > 0} />
        </div>
      ) : null}

      {!loaded ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : loaded.error ? (
        <FormMessage>{loaded.error}</FormMessage>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          onRowClick={(p) => {
            setNotice(null);
            setSelectedId(p.id);
          }}
          empty={q ? "No payments match your search." : queue === "pending" ? "All caught up. No transfers waiting for review." : "No payments in this section."}
          columns={[
            {
              key: "ref",
              label: "Booking",
              render: (p) => (
                <div>
                  <span className="font-mono text-sm font-bold tracking-wider text-foreground">{p.booking.reference}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {p.booking.movie ?? "—"} · {p.booking.seats.join(", ")}
                  </span>
                </div>
              ),
            },
            {
              key: "cust",
              label: "Customer / sender",
              render: (p) => (
                <div className="text-xs">
                  <span className="block font-semibold text-foreground">{p.customer?.name ?? "Hidden"}</span>
                  <span className="text-muted">Sender: {p.payer_name ?? "—"}</span>
                </div>
              ),
            },
            {
              key: "due",
              label: "Due",
              className: "text-right",
              render: (p) => <span className="text-sm font-semibold">{formatPrice(p.expected_amount)}</span>,
            },
            {
              key: "paid",
              label: "Transferred",
              className: "text-right",
              render: (p) =>
                p.submitted_amount === null ? (
                  <span className="text-xs text-muted">No proof yet</span>
                ) : (
                  <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", mismatch(p) ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                    {mismatch(p) ? <AlertTriangle className="size-3.5" aria-label="Does not match" /> : <Check className="size-3.5" aria-label="Matches" />}
                    {formatPrice(p.submitted_amount)}
                  </span>
                ),
            },
            {
              key: "sub",
              label: "Submitted",
              render: (p) => (
                <div className="text-xs">
                  <span className="block font-semibold text-foreground">{fmtDate(p.submitted_at)}</span>
                  <span className="text-muted">{ago(p.submitted_at, loaded.at) ?? ""}</span>
                </div>
              ),
            },
            {
              key: "st",
              label: "Status",
              render: (p) => <Pill tone={statusOf(p.status).tone}>{statusOf(p.status).label}</Pill>,
            },
            {
              key: "act",
              label: "",
              className: "text-right",
              render: (p) => (
                <Button size="sm" variant={p.status === "PROOF_SUBMITTED" || p.status === "UNDER_REVIEW" ? "primary" : "secondary"} className="h-8 px-3 text-xs">
                  {p.status === "PROOF_SUBMITTED" || p.status === "UNDER_REVIEW" || p.status === "EXCEPTION" ? "Review" : "View"}
                </Button>
              ),
            },
          ]}
        />
      )}

      {selected ? <PaymentReview key={selected.id} payment={selected} onClose={() => setSelectedId(null)} onDone={done} /> : null}
    </section>
  );
}

function Summary({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-elevated/70 p-4", bad ? "border-rose-500/40" : "border-line/70")}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-extrabold", bad ? "text-rose-500" : "text-foreground")}>{value}</p>
    </div>
  );
}

type Mode = "reject" | "exception" | "confirm" | "cancel";
const MODE_COPY: Record<Mode, { title: string; label: string; submit: string; danger?: boolean }> = {
  reject: { title: "Reject this slip", label: "Reason (sent to the customer)", submit: "Reject slip", danger: true },
  exception: { title: "Escalate to exceptions", label: "Internal note for the exceptions team", submit: "Escalate" },
  confirm: { title: "Accept payment anyway", label: "Internal audit note", submit: "Accept & issue tickets" },
  cancel: { title: "Cancel booking and queue refund", label: "Internal audit note", submit: "Cancel & refund", danger: true },
};

function PaymentReview({ payment, onClose, onDone }: { payment: AdminPayment; onClose: () => void; onDone: (message: string) => void }) {
  const { can } = useAuth();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewable = payment.status === "PROOF_SUBMITTED" || payment.status === "UNDER_REVIEW";
  const canResolve = payment.status === "EXCEPTION" && can("bookings.resolve_exceptions");
  const bad = mismatch(payment);
  const st = statusOf(payment.status);

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone(success);
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldError("reason") ?? e.fieldError("note") ?? e.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function submitMode(e: React.FormEvent) {
    e.preventDefault();
    const note = text.trim();
    if (mode === "reject") void run(() => adminApi.reject(payment.id, note), `${payment.booking.reference}: slip rejected. Customer notified.`);
    if (mode === "exception") void run(() => adminApi.toException(payment.id, note), `${payment.booking.reference}: sent to exceptions.`);
    if (mode === "confirm")
      void run(
        () => adminApi.resolve(payment.id, { action: "confirm", note, acknowledge_amount_difference: ack }),
        `${payment.booking.reference}: payment accepted. Tickets issued.`,
      );
    if (mode === "cancel") void run(() => adminApi.resolve(payment.id, { action: "cancel", note }), `${payment.booking.reference}: booking cancelled. Refund queued.`);
  }

  return (
    <AdminModal open onClose={onClose} title={`Payment ${payment.booking.reference}`} subtitle={payment.booking.movie ?? undefined} size="full">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Slip */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <ImageIcon className="size-4 text-accent" aria-hidden /> Transfer slip
          </h3>
          {payment.proofs.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">No slip uploaded yet.</div>
          ) : (
            payment.proofs.map((p) => <ProofViewer key={p.id} paymentId={payment.id} proof={p} />)
          )}
        </div>

        {/* Check + actions */}
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Pill tone={st.tone}>{st.label}</Pill>
            <span className="font-mono text-xs text-muted">{payment.payment_reference}</span>
          </div>

          {/* Amount check */}
          <div className={cn("rounded-2xl border p-4", bad ? "border-rose-500/40 bg-rose-500/5" : payment.submitted_amount !== null ? "border-emerald-500/40 bg-emerald-500/5" : "border-line")}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Amount due</p>
                <p className="mt-1 text-2xl font-extrabold">{formatPrice(payment.expected_amount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Customer says they sent</p>
                <p className={cn("mt-1 text-2xl font-extrabold", bad ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                  {payment.submitted_amount !== null ? formatPrice(payment.submitted_amount) : "—"}
                </p>
              </div>
            </div>
            {payment.submitted_amount !== null ? (
              <p className={cn("mt-3 flex items-center gap-2 text-sm font-semibold", bad ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                {bad ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                {bad
                  ? `Off by ${formatPrice(Math.abs(payment.submitted_amount - payment.expected_amount))}. Reject it or escalate to exceptions.`
                  : "Amounts match. Confirm the slip shows the same, then verify."}
              </p>
            ) : null}
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line/60 bg-surface/40 p-4 text-sm">
            <Detail label="Sender name" value={payment.payer_name} />
            <Detail label="Transfer date" value={payment.transfer_date} />
            <Detail label="Customer" value={payment.customer ? payment.customer.name : "Hidden"} sub={payment.customer?.email} />
            <Detail label="Paid into" value={payment.bank_account?.bank_name} sub={payment.bank_account?.account_name} />
            <Detail label="Seats" value={payment.booking.seats.join(", ")} />
            <Detail label="Screening" value={fmtDate(payment.booking.starts_at)} sub={payment.booking.cinema ?? undefined} />
            <Detail label="Submitted" value={fmtDate(payment.submitted_at)} />
            <Detail label="Pay by" value={fmtDate(payment.booking.payment_deadline_at)} />
          </dl>

          {payment.reviews.length > 0 && (
            <details className="rounded-2xl border border-line/60 bg-surface/40 p-4 text-sm">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted">History ({payment.reviews.length})</summary>
              <ul className="mt-3 space-y-2.5 text-xs">
                {payment.reviews.map((r, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                    <div>
                      <p>
                        <strong className="capitalize">{r.decision}</strong> by {r.reviewer ?? "System"} · {fmtDate(r.at)}
                      </p>
                      {r.reason && <p className="text-muted">{r.reason}</p>}
                      {r.notes && <p className="text-muted">Note: {r.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <FormMessage>{error}</FormMessage>}

          {mode ? (
            <form onSubmit={submitMode} className="space-y-3 rounded-2xl border border-line bg-surface/80 p-4">
              <p className="font-bold">{MODE_COPY[mode].title}</p>
              <label htmlFor="decision-text" className="block text-xs font-semibold text-muted">
                {MODE_COPY[mode].label}
              </label>
              <textarea
                id="decision-text"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder={mode === "reject" ? "e.g. The slip shows a different amount." : "At least 5 characters"}
                className="w-full rounded-xl border border-line/80 bg-background/90 p-3 text-sm outline-none focus:border-accent"
              />
              {mode === "confirm" && bad && (
                <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
                  I accept that the transferred amount differs from the amount due.
                </label>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={busy || text.trim().length < 5 || (mode === "confirm" && bad && !ack)}
                  className={cn(MODE_COPY[mode].danger && "bg-rose-600 text-white shadow-none hover:bg-rose-700")}
                >
                  {busy ? "Saving…" : MODE_COPY[mode].submit}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                  Back
                </Button>
              </div>
            </form>
          ) : reviewable ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={busy || !payment.amount_matches}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: "Verify this transfer?",
                      message: `${formatPrice(payment.submitted_amount ?? 0)} for ${payment.booking.reference}. Tickets are issued to the customer.`,
                      confirmLabel: "Verify & issue tickets",
                      tone: "success",
                    })
                  ) {
                    void run(() => adminApi.verify(payment.id), `${payment.booking.reference}: payment verified. Tickets issued.`);
                  }
                }}
              >
                <Check className="size-4" aria-hidden /> Verify & issue tickets
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => setMode("reject")} className="text-rose-500">
                  Reject slip
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setMode("exception")}>
                  Escalate
                </Button>
              </div>
            </div>
          ) : canResolve ? (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => setMode("confirm")}>
                Accept payment
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setMode("cancel")} className="text-rose-500">
                Cancel & refund
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-line/60 bg-surface/40 p-4 text-sm text-muted">No action needed for this payment.</p>
          )}
        </div>
      </div>
    </AdminModal>
  );
}

function Detail({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{value || "—"}</dd>
      {sub ? <dd className="truncate text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}

function ProofViewer({ paymentId, proof }: { paymentId: string; proof: AdminPayment["proofs"][number] }) {
  const [state, setState] = useState<{ url?: string; error?: string } | null>(null);
  const [zoom, setZoom] = useState(false);
  const isPdf = proof.mime === "application/pdf";

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    adminApi
      .proofBlob(paymentId, proof.id)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setState({ url });
      })
      .catch(() => live && setState({ error: "The proof slip could not be loaded." }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [paymentId, proof.id]);

  if (!state) return <Skeleton className="h-80 rounded-2xl" />;
  if (state.error || !state.url) return <FormMessage>{state.error}</FormMessage>;

  const actions = (
    <div className="flex gap-2">
      <a href={state.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent-text">
        <ExternalLink className="size-3.5" aria-hidden /> Open
      </a>
      <a href={state.url} download={`payment-proof-${proof.id}${isPdf ? ".pdf" : ""}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent-text">
        <Download className="size-3.5" aria-hidden /> Download
      </a>
    </div>
  );

  if (isPdf) {
    return (
      <div className="space-y-2">
        <iframe src={state.url} title="Transfer slip (PDF)" className="h-[32rem] w-full rounded-2xl border border-line bg-white" />
        {actions}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setZoom((z) => !z)}
        aria-label={zoom ? "Shrink slip" : "Enlarge slip"}
        className={cn(
          "flex w-full cursor-zoom-in items-center justify-center overflow-auto rounded-2xl border border-line bg-black/40 p-2",
          zoom ? "max-h-[75vh] cursor-zoom-out" : "max-h-[32rem]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.url} alt="Customer's transfer slip" className={cn("rounded-xl", zoom ? "max-w-none" : "max-h-[30rem] w-auto object-contain")} />
      </button>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Click the slip to zoom. {Math.round(proof.size / 1024)} KB</span>
        {actions}
      </div>
    </div>
  );
}
