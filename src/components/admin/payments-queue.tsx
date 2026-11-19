"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type AdminPayment } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage, inputClass } from "@/components/auth/form-kit";
import { PageTitle, Pill } from "./kit";
import { cn } from "@/lib/utils";

type Queue = "pending" | "exceptions" | "all";
const TABS: { key: Queue; label: string }[] = [
  { key: "pending", label: "Awaiting review" },
  { key: "exceptions", label: "Exceptions" },
  { key: "all", label: "All" },
];

const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso)) : "—");

export function PaymentsQueue() {
  const [queue, setQueue] = useState<Queue>("pending");
  const [list, setList] = useState<{ queue: Queue; items?: AdminPayment[]; error?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null); // kept here: the reviewed payment leaves the queue and its panel unmounts

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
  const refresh = useCallback((message?: string) => { if (message) setNotice(message); setNonce((n) => n + 1); }, []);

  return (
    <section>
      <PageTitle
        title="Payments Verification Queue"
        eyebrow="Finance & Settlements"
        hint="Review customer bank transfer payment slips and settle ticket reservations."
      />

      <div role="tablist" aria-label="Queue" className="mb-6 inline-flex rounded-xl border border-line/70 bg-surface/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={queue === t.key}
            onClick={() => {
              setQueue(t.key);
              setSelectedId(null);
              setNotice(null);
            }}
            className={cn(
              "min-h-9 rounded-lg px-4 text-xs font-semibold transition-all",
              queue === t.key
                ? "bg-accent text-on-accent shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div>
          {!loaded ? (
            <Skeleton className="h-48" />
          ) : loaded.error ? (
            <FormMessage>{loaded.error}</FormMessage>
          ) : loaded.items?.length === 0 ? (
            <EmptyState title="Nothing here" description="No payments in this queue." />
          ) : (
            <ul className="grid gap-2" aria-label="Payments">
              {loaded.items?.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => { setNotice(null); setSelectedId(p.id); }}
                    aria-pressed={p.id === selectedId}
                    className={cn("w-full rounded-card border p-4 text-left transition", p.id === selectedId ? "border-accent bg-accent/10" : "border-line bg-elevated hover:border-accent")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">{p.booking.reference}</span>
                      <span className="text-xs font-semibold text-muted">{p.status.replaceAll("_", " ")}</span>
                    </span>
                    <span className="mt-1 block text-sm">{p.booking.movie ?? "Booking"} · {p.booking.seats.join(", ")}</span>
                    <span className={cn("mt-1 block text-sm font-semibold", p.submitted_amount !== null && !p.amount_matches && "text-red-500")}>
                      {p.submitted_amount !== null ? formatPrice(p.submitted_amount) : "No proof yet"}
                      {p.submitted_amount !== null && !p.amount_matches ? ` (due ${formatPrice(p.expected_amount)})` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {notice ? <p role="status" className="mb-3 rounded-control border border-accent/50 bg-accent/10 p-3 text-sm">{notice}</p> : null}
          {selected ? <PaymentDetail key={selected.id} payment={selected} onChanged={refresh} /> : <p className="rounded-card border border-dashed border-line p-8 text-center text-muted">Select a payment to review it.</p>}
        </div>
      </div>
    </section>
  );
}

function PaymentDetail({ payment, onChanged }: { payment: AdminPayment; onChanged: (message?: string) => void }) {
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
      setError(e instanceof ApiError ? (e.fieldError("reason") ?? e.fieldError("note") ?? e.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-card border border-line bg-elevated p-5 sm:p-6" aria-label={`Payment ${payment.booking.reference}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="display text-3xl">{payment.booking.reference}</h2>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text">{payment.status.replaceAll("_", " ")}</span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Item label="Movie" value={payment.booking.movie ?? "—"} />
        <Item label="Seats" value={payment.booking.seats.join(", ")} />
        <Item label="Amount due" value={formatPrice(payment.expected_amount)} />
        <Item label="Amount transferred" value={payment.submitted_amount !== null ? formatPrice(payment.submitted_amount) : "—"} tone={payment.submitted_amount !== null && !payment.amount_matches ? "bad" : undefined} />
        <Item label="Transfer date" value={payment.transfer_date ?? "—"} />
        <Item label="Sender name" value={payment.payer_name ?? "—"} />
        <Item label="Submitted" value={fmtDate(payment.submitted_at)} />
        <Item label="Payment deadline" value={fmtDate(payment.booking.payment_deadline_at)} />
        {payment.customer ? <Item label="Customer" value={`${payment.customer.name} (${payment.customer.email})`} /> : null}
        {payment.bank_account ? <Item label="Paid into" value={`${payment.bank_account.bank_name} · ${payment.bank_account.account_name}`} /> : null}
      </dl>

      {!payment.amount_matches && payment.submitted_amount !== null ? (
        <div className="mt-4">
          <FormMessage>The amount transferred differs from the amount due. It cannot be verified as is: reject it or send it to the exception queue.</FormMessage>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {payment.proofs.map((p) => (
          <ProofViewer key={p.id} paymentId={payment.id} proof={p} />
        ))}
        {payment.proofs.length === 0 ? <p className="text-sm text-muted">No proof uploaded.</p> : null}
      </div>

      {payment.reviews.length ? (
        <div className="mt-5">
          <h3 className="font-semibold">Review history</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {payment.reviews.map((r, i) => (
              <li key={i} className="py-2">
                <strong className="capitalize">{r.decision}</strong> by {r.reviewer ?? "system"} · {fmtDate(r.at)}
                {r.reason ? <span className="block text-muted">{r.reason}</span> : null}
                {r.notes ? <span className="block text-muted">Note: {r.notes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {done ? <p role="status" className="mt-4 rounded-control border border-accent/50 bg-accent/10 p-3 text-sm">{done}</p> : null}
      {error ? <div className="mt-4"><FormMessage>{error}</FormMessage></div> : null}

      {reviewable && !done ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={busy || !payment.amount_matches}
            onClick={() => {
              if (window.confirm(`Verify the transfer of ${formatPrice(payment.submitted_amount ?? 0)} for ${payment.booking.reference}? Tickets will be issued.`)) {
                void run(() => adminApi.verify(payment.id), "Payment verified. Tickets issued.");
              }
            }}
          >
            Verify payment
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode("reject")}>Reject…</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode("exception")}>Send to exceptions…</Button>
        </div>
      ) : null}

      {canResolve && !done ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => setMode("confirm")}>Accept payment…</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode("cancel")}>Cancel booking and refund…</Button>
        </div>
      ) : isException && !done ? (
        <p className="mt-5 text-sm text-muted">Only an administrator can resolve exceptions.</p>
      ) : null}

      {mode ? (
        <form
          className="mt-5 grid gap-3 rounded-control border border-line bg-background p-4"
          aria-label={mode === "reject" ? "Reject payment" : mode === "exception" ? "Send to exceptions" : mode === "confirm" ? "Accept payment" : "Cancel booking"}
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "reject") void run(() => adminApi.reject(payment.id, text.trim()), "Payment rejected. The customer was notified.");
            if (mode === "exception") void run(() => adminApi.toException(payment.id, text.trim()), "Sent to the exception queue.");
            if (mode === "confirm") void run(() => adminApi.resolve(payment.id, { action: "confirm", note: text.trim(), acknowledge_amount_difference: ack }), "Payment accepted. Tickets issued.");
            if (mode === "cancel") void run(() => adminApi.resolve(payment.id, { action: "cancel", note: text.trim() }), "Booking cancelled; refund queued.");
          }}
        >
          <label htmlFor="decision-text" className="text-sm font-semibold">
            {mode === "reject" ? "Reason shown to the customer (required)" : "Note for the record (required)"}
          </label>
          <textarea id="decision-text" value={text} onChange={(e) => setText(e.target.value)} minLength={5} maxLength={300} rows={3} className={cn(inputClass(false), "h-auto py-2")} />
          {mode === "confirm" && !payment.amount_matches ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              I acknowledge the transferred amount differs from the amount due.
            </label>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || text.trim().length < 5}>Confirm</Button>
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>Back</Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function Item({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-semibold", tone === "bad" && "text-red-500")}>{value}</dd>
    </div>
  );
}

/** Loads the protected file through the authenticated API and shows it from a local object URL. */
function ProofViewer({ paymentId, proof }: { paymentId: string; proof: AdminPayment["proofs"][number] }) {
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
      .catch(() => live && setState({ error: "The proof could not be loaded." }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [paymentId, proof.id]);

  if (!state) return <Skeleton className="h-40" />;
  if (state.error || !state.url) return <FormMessage>{state.error}</FormMessage>;
  return isPdf ? (
    <a href={state.url} download="payment-proof.pdf" className="font-semibold text-accent-text hover:underline">
      Download PDF proof ({Math.round(proof.size / 1024)} KB)
    </a>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URL of a protected file
    <img src={state.url} alt="Customer's transfer receipt" className="max-h-96 rounded-control border border-line object-contain" />
  );
}
