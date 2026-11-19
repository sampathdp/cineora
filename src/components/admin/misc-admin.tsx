"use client";

import { useEffect, useState } from "react";
import { Building, Check, CreditCard, Landmark, Plus, Undo2 } from "lucide-react";
import { adminApi, type AdminBankAccount, type AdminRefund } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage, inputClass } from "@/components/auth/form-kit";
import { AdminModal, PageTitle, Pill, TextField, TextArea } from "./kit";
import { cn } from "@/lib/utils";

export function RefundsQueue() {
  const [state, setState] = useState<{ items?: AdminRefund[]; error?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Modals for payout and deny
  const [payoutTarget, setPayoutTarget] = useState<AdminRefund | null>(null);
  const [payoutRef, setPayoutRef] = useState("");
  const [denyTarget, setDenyTarget] = useState<AdminRefund | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .refunds("pending")
      .then((items) => live && setState({ items }))
      .catch(() => live && setState({ error: "Could not load refund requests." }));
    return () => {
      live = false;
    };
  }, [nonce]);

  async function act(fn: () => Promise<unknown>) {
    setActing(true);
    setError(null);
    try {
      await fn();
      setNonce((n) => n + 1);
      setPayoutTarget(null);
      setDenyTarget(null);
      setPayoutRef("");
      setDenyReason("");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.fieldError("reference") ?? e.fieldError("reason") ?? e.message
          : "Something went wrong.",
      );
    } finally {
      setActing(false);
    }
  }

  return (
    <section>
      <PageTitle
        title="Refund Requests"
        eyebrow="Finance & Customer Settle"
        hint="Review customer refund requests. Once approved with a payout transfer reference, ticket inventory is released."
      />

      {error ? <div className="mb-4"><FormMessage>{error}</FormMessage></div> : null}

      <div className="mt-4">
        {!state ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : state.items?.length === 0 ? (
          <EmptyState
            title="No open refund requests"
            description="All refund submissions have been resolved."
          />
        ) : (
          <ul className="grid gap-3">
            {state.items?.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm transition hover:border-line"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3">
                  <span className="font-mono text-base font-bold text-foreground">
                    {r.booking.reference}
                  </span>
                  <span className="text-base font-bold text-accent">
                    {formatPrice(r.amount)}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Movie</p>
                  <p className="text-sm font-medium text-foreground">{r.booking.movie}</p>
                </div>
                <div className="mt-2.5 rounded-lg bg-surface/60 p-3 border border-line/40">
                  <p className="text-xs text-muted mb-0.5 font-semibold">Reason stated by customer:</p>
                  <p className="text-sm italic text-foreground">{r.reason}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPayoutRef("");
                      setPayoutTarget(r);
                    }}
                  >
                    Record payout…
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDenyReason("");
                      setDenyTarget(r);
                    }}
                  >
                    Deny…
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Record Payout Modal */}
      <AdminModal
        open={!!payoutTarget}
        onClose={() => setPayoutTarget(null)}
        title="Record Refund Payout"
        subtitle={`Booking reference: ${payoutTarget?.booking.reference ?? ""}`}
        size="sm"
      >
        {payoutTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (payoutRef.trim()) void act(() => adminApi.payRefund(payoutTarget.id, payoutRef.trim()));
            }}
            className="grid gap-4"
          >
            <div className="rounded-xl border border-line/60 bg-surface/50 p-3">
              <p className="text-xs text-muted">Refund Amount</p>
              <p className="text-2xl font-bold text-accent">{formatPrice(payoutTarget.amount)}</p>
              <p className="text-xs text-muted mt-1">{payoutTarget.booking.movie}</p>
            </div>
            <div>
              <label htmlFor="payout-ref" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                Bank Transfer Reference
              </label>
              <input
                id="payout-ref"
                required
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="e.g. REF-2026-98124"
                className={inputClass(false)}
              />
              <p className="mt-1 text-xs text-muted">Wire/transfer transaction ID from your banking app</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/40">
              <Button type="button" variant="ghost" onClick={() => setPayoutTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={acting || !payoutRef.trim()}>{acting ? "Recording…" : "Confirm Payout"}</Button>
            </div>
          </form>
        )}
      </AdminModal>

      {/* Deny Refund Modal */}
      <AdminModal
        open={!!denyTarget}
        onClose={() => setDenyTarget(null)}
        title="Deny Refund Request"
        subtitle={`Booking reference: ${denyTarget?.booking.reference ?? ""}`}
        size="sm"
      >
        {denyTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (denyReason.trim()) void act(() => adminApi.denyRefund(denyTarget.id, denyReason.trim()));
            }}
            className="grid gap-4"
          >
            <div className="rounded-xl border border-line/60 bg-surface/50 p-3">
              <p className="text-xs text-muted">Customer Claim</p>
              <p className="text-sm italic text-foreground mt-0.5">{denyTarget.reason}</p>
            </div>
            <div>
              <label htmlFor="deny-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                Reason for denial (shown to customer)
              </label>
              <textarea
                id="deny-reason"
                required
                rows={3}
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Explain why this request is ineligible under policy..."
                className={cn(inputClass(false), "h-auto py-2")}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/40">
              <Button type="button" variant="ghost" onClick={() => setDenyTarget(null)}>Cancel</Button>
              <Button type="submit" variant="secondary" disabled={acting || !denyReason.trim()}>{acting ? "Denying…" : "Deny Request"}</Button>
            </div>
          </form>
        )}
      </AdminModal>
    </section>
  );
}

export function BankAccounts() {
  const [state, setState] = useState<{ items?: AdminBankAccount[]; error?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    swift: "",
    instructions: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi
      .bankAccounts()
      .then((items) => live && setState({ items }))
      .catch(() => live && setState({ error: "Could not load bank accounts." }));
    return () => {
      live = false;
    };
  }, [nonce]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await adminApi.addBankAccount({
        ...form,
        swift: form.swift || undefined,
        instructions: form.instructions || undefined,
      });
      setForm({ bank_name: "", account_name: "", account_number: "", swift: "", instructions: "" });
      setOpen(false);
      setNonce((n) => n + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string) => (
    <div>
      <label htmlFor={`ba-${key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={`ba-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={inputClass(!!errors[key])}
        aria-invalid={!!errors[key]}
      />
      {errors[key] ? (
        <p role="alert" className="mt-1 text-xs text-rose-500">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <section>
      <PageTitle
        title="Bank Accounts & Gateways"
        eyebrow="Finance & Treasury"
        hint="Customers are shown active bank transfer accounts on the checkout screen when paying by offline wire."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> Add bank account
          </Button>
        }
      />

      <div className="max-w-4xl">
        {!state ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : (
          <ul className="grid gap-3">
            {state.items?.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Landmark className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {a.bank_name} · <span className="text-muted">{a.account_name}</span>
                    </p>
                    <p className="font-mono text-xs text-foreground mt-0.5">
                      {a.account_number}
                      {a.cinema ? ` · ${a.cinema.name}` : " · All cinemas"}
                    </p>
                    {a.swift && <p className="text-[11px] text-muted">SWIFT: {a.swift}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Pill tone={a.is_active ? "good" : "neutral"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Pill>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await adminApi.updateBankAccount(a.id, { is_active: !a.is_active });
                      setNonce((n) => n + 1);
                    }}
                  >
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
            {state.items?.length === 0 ? (
              <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                No bank accounts configured yet. Customers cannot pay until at least one account is active.
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Add Bank Account Modal */}
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Bank Account"
        subtitle="Configure deposit bank details for customer bank transfer payments"
        size="md"
      >
        <form
          onSubmit={add}
          noValidate
          className="grid gap-4"
          aria-label="Add bank account"
        >
          {field("bank_name", "Bank name")}
          {field("account_name", "Account holder / Beneficiary")}
          {field("account_number", "Account number")}
          {field("swift", "SWIFT/BIC (optional)")}
          {field("instructions", "Transfer instructions shown to customer (optional)")}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/40">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving account…" : "Save bank account"}
            </Button>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
