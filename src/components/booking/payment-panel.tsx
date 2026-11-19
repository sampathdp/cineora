"use client";

import { useEffect, useState } from "react";
import { Copy, Landmark, Upload } from "lucide-react";
import type { ApiBooking } from "@/lib/api/bookings";
import { paymentsApi, type PaymentInfo } from "@/lib/api/payments";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { FormMessage, inputClass } from "@/components/auth/form-kit";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Bank details, proof upload and payment status for one booking. The server decides every state. */
export function PaymentPanel({ booking, onChanged }: { booking: ApiBooking; onChanged: () => void }) {
  const [state, setState] = useState<{ id: string; payment: PaymentInfo | null; error?: string } | null>(null);
  const status = booking.status;
  const relevant = ["PENDING_PAYMENT", "PAYMENT_REJECTED", "PAYMENT_REVIEW", "PAYMENT_EXCEPTION"].includes(status);

  useEffect(() => {
    if (!relevant) return;
    let live = true;
    paymentsApi
      .get(booking.id)
      .then((payment) => live && setState({ id: `${booking.id}:${status}`, payment }))
      .catch((e: unknown) => live && setState({ id: `${booking.id}:${status}`, payment: null, error: e instanceof ApiError ? e.message : "Could not load payment details." }));
    return () => {
      live = false;
    };
  }, [booking.id, status, relevant]);

  if (!relevant) return null;
  const loaded = state?.id === `${booking.id}:${status}` ? state : null;
  if (!loaded) return <Skeleton className="h-40" />;
  if (loaded.error) return <FormMessage>{loaded.error}</FormMessage>;
  const payment = loaded.payment;

  const canUpload = status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
  return (
    <section className="rounded-card border border-line bg-elevated p-5 sm:p-6" aria-labelledby="pay-heading">
      <h2 id="pay-heading" className="display flex items-center gap-2 text-2xl">
        <Landmark className="size-5 text-accent-text" aria-hidden /> Pay by bank transfer
      </h2>

      {status === "PAYMENT_REVIEW" ? (
        <p role="status" className="mt-3 text-sm text-muted">
          We received your transfer proof and a member of staff is checking it. Your seats are protected while we review. You will get an email when it is done.
        </p>
      ) : null}
      {status === "PAYMENT_EXCEPTION" ? (
        <p role="status" className="mt-3 text-sm text-muted">
          Your payment needs a manual check by our team. Your seats stay reserved while we look into it, and we will contact you if we need anything.
        </p>
      ) : null}
      {status === "PAYMENT_REJECTED" && payment?.rejection_reason ? (
        <div className="mt-3">
          <FormMessage>We could not verify your transfer: {payment.rejection_reason}</FormMessage>
        </div>
      ) : null}

      {payment ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Bank" value={payment.bank.bank_name} />
          <Row label="Account name" value={payment.bank.account_name} />
          <Row label="Account number" value={payment.bank.account_number} copy />
          {payment.bank.swift ? <Row label="SWIFT/BIC" value={payment.bank.swift} /> : null}
          <Row label="Amount to transfer" value={formatPrice(payment.expected_amount)} />
          <Row label="Transfer memo (important)" value={payment.transfer_memo} copy />
        </dl>
      ) : null}
      {payment?.bank.instructions ? <p className="mt-3 text-sm text-muted">{payment.bank.instructions}</p> : null}

      {canUpload && payment ? (
        <ProofForm bookingId={booking.id} expected={payment.expected_amount} onDone={onChanged} resubmit={status === "PAYMENT_REJECTED"} />
      ) : null}
    </section>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 font-semibold">
        <span className="break-all">{value}</span>
        {copy ? (
          <button
            type="button"
            aria-label={`Copy ${label}`}
            className="rounded p-1 text-muted hover:text-foreground"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard unavailable: the value is still visible */
              }
            }}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? <span className="sr-only">Copied</span> : null}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function ProofForm({ bookingId, expected, onDone, resubmit }: { bookingId: string; expected: number; onDone: () => void; resubmit: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(String(expected));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setErrors((x) => ({ ...x, proof: "" }));
    if (f && !TYPES.includes(f.type)) {
      setFile(null);
      return setErrors((x) => ({ ...x, proof: "Choose a JPEG, PNG, WebP or PDF file." }));
    }
    if (f && f.size > MAX_BYTES) {
      setFile(null);
      return setErrors((x) => ({ ...x, proof: "The file is larger than 5 MB." }));
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!file) next.proof = "Attach your transfer receipt.";
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1) next.submitted_amount = "Enter the amount you transferred, in whole won.";
    if (!date) next.transfer_date = "Choose the transfer date.";
    setErrors(next);
    if (Object.keys(next).length || !file) return;

    setBusy(true);
    try {
      await paymentsApi.submitProof(bookingId, { proof: file, submitted_amount: n, transfer_date: date, payer_name: payer.trim() || undefined });
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        const fields: Record<string, string> = {};
        for (const k of ["proof", "submitted_amount", "transfer_date", "payer_name"]) if (err.fieldError(k)) fields[k] = err.fieldError(k)!;
        setErrors(fields);
        if (!Object.keys(fields).length) setFormError(err.status === 429 ? "Too many attempts. Please wait a minute." : err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-4 border-t border-line pt-5" aria-label="Upload transfer proof">
      <h3 className="font-semibold">{resubmit ? "Upload a new proof" : "After you have transferred, upload your receipt"}</h3>
      <FormMessage>{formError}</FormMessage>
      <div>
        <label htmlFor="proof-file" className="mb-1.5 block text-sm font-semibold">
          Receipt (image or PDF, up to 5 MB)
        </label>
        <label htmlFor="proof-file" className="flex min-h-12 cursor-pointer items-center gap-2 rounded-control border border-dashed border-line px-3 text-sm text-muted hover:border-accent focus-within:border-accent">
          <Upload className="size-4" aria-hidden />
          <span className="truncate">{file ? file.name : "Choose a file"}</span>
        </label>
        <input id="proof-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={pick} aria-describedby="proof-err" />
        {errors.proof ? <p id="proof-err" role="alert" className="mt-1 text-sm text-red-500">{errors.proof}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="mb-1.5 block text-sm font-semibold">Amount transferred (₩)</label>
          <input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={inputClass(!!errors.submitted_amount)} aria-invalid={!!errors.submitted_amount} />
          {errors.submitted_amount ? <p role="alert" className="mt-1 text-sm text-red-500">{errors.submitted_amount}</p> : null}
        </div>
        <div>
          <label htmlFor="tdate" className="mb-1.5 block text-sm font-semibold">Transfer date</label>
          <input id="tdate" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className={inputClass(!!errors.transfer_date)} aria-invalid={!!errors.transfer_date} />
          {errors.transfer_date ? <p role="alert" className="mt-1 text-sm text-red-500">{errors.transfer_date}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="payer" className="mb-1.5 block text-sm font-semibold">Name on the sending account (optional)</label>
          <input id="payer" value={payer} maxLength={120} onChange={(e) => setPayer(e.target.value)} className={inputClass(false)} />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : resubmit ? "Send new proof" : "Send proof"}
        </Button>
      </div>
    </form>
  );
}
