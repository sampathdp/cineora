"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { adminApi, type AdminPayment } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
import { PageTitle, Pill } from "./kit";
import { cn } from "@/lib/utils";

type Queue = "pending" | "exceptions" | "all";
const TABS: { key: Queue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pending", label: "Awaiting Review", icon: Clock },
  { key: "exceptions", label: "Exceptions", icon: AlertTriangle },
  { key: "all", label: "All Records", icon: Banknote },
];

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(iso))
    : "—";

export function PaymentsQueue() {
  const [queue, setQueue] = useState<Queue>("pending");
  const [list, setList] = useState<{ queue: Queue; items?: AdminPayment[]; error?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    adminApi
      .payments(queue)
      .then((items) => live && setList({ queue, items }))
      .catch(() => live && setList({ queue, error: "Could not load the queue." }));
    return () => {
      live = false;
    };
  }, [queue, nonce]);

  const loaded = list?.queue === queue ? list : null;
  const selected = loaded?.items?.find((p) => p.id === selectedId) ?? null;
  const refresh = useCallback((message?: string) => {
    if (message) setNotice(message);
    setNonce((n) => n + 1);
  }, []);

  return (
    <section className="space-y-6">
      <PageTitle
        title="Payments Verification Queue"
        eyebrow="Finance & Settlements"
        icon={Banknote}
        hint="Review customer bank transfer payment slips, verify submitted amounts, and issue official ticket reservations."
      />

      {/* Modern Queue Tabs */}
      <div
        role="tablist"
        aria-label="Queue"
        className="inline-flex rounded-2xl border border-line/70 bg-surface/70 p-1.5 shadow-sm backdrop-blur-sm"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = queue === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setQueue(t.key);
                setSelectedId(null);
                setNotice(null);
              }}
              className={cn(
                "flex items-center gap-2 min-h-9 rounded-xl px-4 text-xs font-bold transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        {/* Left column: List of payments in the active queue */}
        <div>
          {!loaded ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : loaded.error ? (
            <FormMessage>{loaded.error}</FormMessage>
          ) : loaded.items?.length === 0 ? (
            <EmptyState title="Queue is Clear" description="No payments awaiting review in this section." />
          ) : (
            <ul className="grid gap-2.5" aria-label="Payments">
              {loaded.items?.map((p) => {
                const isSelected = p.id === selectedId;
                const mismatch = p.submitted_amount !== null && !p.amount_matches;

                return (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setNotice(null);
                        setSelectedId(p.id);
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        "group w-full rounded-2xl border p-4 text-left transition-all duration-150 cursor-pointer shadow-xs",
                        isSelected
                          ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent"
                          : "border-line/70 bg-elevated/70 hover:border-line hover:bg-surface/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-extrabold text-foreground tracking-wider">
                          {p.booking.reference}
                        </span>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          {p.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="mt-2 text-xs">
                        <p className="font-medium text-foreground truncate">
                          {p.booking.movie ?? "Movie Ticket"}
                        </p>
                        <p className="text-muted mt-0.5">
                          Seats: {p.booking.seats.join(", ")}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-xs">
                        <span className={cn("font-bold", mismatch ? "text-rose-500" : "text-accent")}>
                          {p.submitted_amount !== null ? formatPrice(p.submitted_amount) : "No proof slip"}
                        </span>
                        {mismatch && (
                          <span className="rounded bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-bold text-rose-500">
                            Differs from due
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right column: Active payment review workbench */}
        <div>
          {notice && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm font-semibold text-accent-text shadow-sm animate-in fade-in"
            >
              <CheckCircle2 className="size-5 shrink-0 text-accent" />
              <span>{notice}</span>
            </div>
          )}

          {selected ? (
            <PaymentDetail key={selected.id} payment={selected} onChanged={refresh} />
          ) : (
            <div className="rounded-3xl border border-dashed border-line/80 bg-surface/30 p-12 text-center text-muted">
              <Banknote className="mx-auto size-10 opacity-30 mb-3" />
              <p className="font-bold text-foreground">No Payment Selected</p>
              <p className="text-xs text-muted mt-1">
                Choose a payment request from the list on the left to verify customer transfer receipts and settle tickets.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PaymentDetail({
  payment,
  onChanged,
}: {
  payment: AdminPayment;
  onChanged: (message?: string) => void;
}) {
  const { can } = useAuth();
  const [mode, setMode] = useState<"reject" | "exception" | "confirm" | "cancel" | null>(null);
  const [text, setText] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reviewable = payment.status === "PROOF_SUBMITTED" || payment.status === "UNDER_REVIEW";
  const isException = payment.status === "EXCEPTION";
  const canResolve = isException && can("bookings.resolve_exceptions");

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setDone(success);
      setMode(null);
      setText("");
      onChanged(success);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.fieldError("reason") ?? e.fieldError("note") ?? e.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="rounded-3xl border border-line/80 bg-elevated/80 p-6 sm:p-7 shadow-sm backdrop-blur-md space-y-6"
      aria-label={`Payment ${payment.booking.reference}`}
    >
      {/* Workbench Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Booking Reference</span>
          <h2 className="display text-3xl font-extrabold text-foreground font-mono tracking-wider">
            {payment.booking.reference}
          </h2>
        </div>
        <Pill tone={payment.status === "VERIFIED" ? "good" : payment.status === "EXCEPTION" || payment.status === "REJECTED" ? "bad" : "warn"}>
          {payment.status.replaceAll("_", " ")}
        </Pill>
      </div>

      {/* Financial Comparison Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line/60 bg-surface/50 p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Amount Due</span>
          <p className="mt-1 text-lg font-extrabold text-foreground">{formatPrice(payment.expected_amount)}</p>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-3.5",
            payment.submitted_amount !== null && !payment.amount_matches
              ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">Transferred</span>
          <p className="mt-1 text-lg font-extrabold">
            {payment.submitted_amount !== null ? formatPrice(payment.submitted_amount) : "No proof"}
          </p>
        </div>
        <div className="rounded-2xl border border-line/60 bg-surface/50 p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Sender Name</span>
          <p className="mt-1 text-sm font-semibold text-foreground truncate">{payment.payer_name ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-line/60 bg-surface/50 p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Transfer Date</span>
          <p className="mt-1 text-sm font-semibold text-foreground truncate">{payment.transfer_date ?? "—"}</p>
        </div>
      </div>

      {/* Meta Specs */}
      <div className="rounded-2xl border border-line/60 bg-surface/40 p-4 space-y-2 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="text-muted">
            Movie: <strong className="text-foreground">{payment.booking.movie}</strong>
          </p>
          <p className="text-muted">
            Seats: <strong className="text-foreground">{payment.booking.seats.join(", ")}</strong>
          </p>
          <p className="text-muted">
            Submitted: <strong className="text-foreground">{fmtDate(payment.submitted_at)}</strong>
          </p>
          <p className="text-muted">
            Payment Deadline: <strong className="text-foreground">{fmtDate(payment.booking.payment_deadline_at)}</strong>
          </p>
          {payment.customer && (
            <p className="text-muted sm:col-span-2">
              Customer: <strong className="text-foreground">{payment.customer.name}</strong> ({payment.customer.email})
            </p>
          )}
          {payment.bank_account && (
            <p className="text-muted sm:col-span-2">
              Credited To: <strong className="text-foreground">{payment.bank_account.bank_name}</strong> · {payment.bank_account.account_name}
            </p>
          )}
        </div>
      </div>

      {!payment.amount_matches && payment.submitted_amount !== null && (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Transfer Amount Mismatch Detected</p>
            <p className="mt-0.5 opacity-90">
              The transferred amount differs from the amount due. It cannot be verified as is: reject the slip or escalate it to the exception review queue.
            </p>
          </div>
        </div>
      )}

      {/* Customer Bank Transfer Proof Attachment */}
      <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <ImageIcon className="size-4 text-accent" />
          <span>Customer Transfer Slip Attachment</span>
        </h3>
        <div className="space-y-3">
          {payment.proofs.map((p) => (
            <ProofViewer key={p.id} paymentId={payment.id} proof={p} />
          ))}
          {payment.proofs.length === 0 && (
            <p className="text-xs italic text-muted py-2">No bank transfer proof slip uploaded by the customer.</p>
          )}
        </div>
      </div>

      {/* Review History Logs */}
      {payment.reviews.length > 0 && (
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Review Audit Log</h3>
          <ul className="space-y-2 text-xs">
            {payment.reviews.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-accent mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">
                    <strong className="capitalize font-bold">{r.decision}</strong> by {r.reviewer ?? "System"} · {fmtDate(r.at)}
                  </p>
                  {r.reason && <p className="text-muted mt-0.5">{r.reason}</p>}
                  {r.notes && <p className="text-muted mt-0.5">Note: {r.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="size-4" />
          <span>{done}</span>
        </div>
      )}

      {error && <FormMessage>{error}</FormMessage>}

      {/* Primary Action Buttons */}
      {reviewable && !done && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
          <Button
            disabled={busy || !payment.amount_matches}
            onClick={() => {
              if (
                window.confirm(
                  `Verify the transfer of ${formatPrice(payment.submitted_amount ?? 0)} for ${payment.booking.reference}? Official tickets will be issued.`,
                )
              ) {
                void run(() => adminApi.verify(payment.id), "Payment verified. Tickets issued.");
              }
            }}
            className="shadow-sm"
          >
            <Check className="size-4 mr-1.5" />
            <span>Verify & Issue Tickets</span>
          </Button>

          <Button variant="secondary" disabled={busy} onClick={() => setMode("reject")}>
            Reject Slip…
          </Button>

          <Button variant="secondary" disabled={busy} onClick={() => setMode("exception")}>
            Escalate to Exceptions…
          </Button>
        </div>
      )}

      {canResolve && !done && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
          <Button disabled={busy} onClick={() => setMode("confirm")} className="shadow-sm">
            Accept Payment Override…
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode("cancel")} className="text-rose-500">
            Cancel Booking & Queue Refund…
          </Button>
        </div>
      )}

      {/* Mode Sub-Forms (Reject, Exception, Override Confirm, Cancel) */}
      {mode && (
        <form
          className="rounded-2xl border border-line bg-surface/90 p-5 space-y-4 shadow-md animate-in fade-in"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "reject") void run(() => adminApi.reject(payment.id, text.trim()), "Payment rejected. Customer notified.");
            if (mode === "exception") void run(() => adminApi.toException(payment.id, text.trim()), "Sent to exception queue.");
            if (mode === "confirm")
              void run(
                () =>
                  adminApi.resolve(payment.id, {
                    action: "confirm",
                    note: text.trim(),
                    acknowledge_amount_difference: ack,
                  }),
                "Payment accepted. Tickets issued.",
              );
            if (mode === "cancel")
              void run(
                () => adminApi.resolve(payment.id, { action: "cancel", note: text.trim() }),
                "Booking cancelled. Refund queued.",
              );
          }}
        >
          <label htmlFor="decision-text" className="block text-xs font-bold uppercase tracking-wider text-muted">
            {mode === "reject" ? "Reason Sent to Customer (Required)" : "Staff Audit Note (Required)"}
          </label>
          <textarea
            id="decision-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={5}
            maxLength={300}
            rows={3}
            placeholder="Type detailed reason or transaction reference…"
            className="w-full rounded-xl border border-line/80 bg-background/90 p-3.5 text-sm outline-none focus:border-accent"
          />

          {mode === "confirm" && !payment.amount_matches && (
            <label className="flex items-start gap-2.5 text-xs text-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-[var(--accent)]"
              />
              <span>I acknowledge that the transferred amount differs from the expected amount due.</span>
            </label>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy || text.trim().length < 5}>
              Confirm Decision
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}

function ProofViewer({
  paymentId,
  proof,
}: {
  paymentId: string;
  proof: AdminPayment["proofs"][number];
}) {
  const [state, setState] = useState<{ url?: string; error?: string } | null>(null);
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

  if (!state) return <Skeleton className="h-44 rounded-xl" />;
  if (state.error || !state.url) return <FormMessage>{state.error}</FormMessage>;

  return isPdf ? (
    <a
      href={state.url}
      download="payment-proof.pdf"
      className="inline-flex items-center gap-2 rounded-xl border border-line/80 bg-surface px-4 py-2.5 text-xs font-bold text-accent hover:border-accent transition shadow-sm"
    >
      <Download className="size-4" />
      <span>Download PDF Proof Receipt ({Math.round(proof.size / 1024)} KB)</span>
    </a>
  ) : (
    <div className="relative max-h-96 overflow-hidden rounded-2xl border border-line/80 bg-black/40 flex items-center justify-center p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.url}
        alt="Customer's transfer receipt"
        className="max-h-96 w-auto rounded-xl object-contain shadow-lg"
      />
    </div>
  );
}
