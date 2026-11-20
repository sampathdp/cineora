"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building,
  Check,
  CreditCard,
  Landmark,
  Plus,
  Receipt,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { adminApi, type AdminBankAccount, type AdminRefund } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
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
    <section className="space-y-6">
      <PageTitle
        title="Refund Requests & Payouts"
        eyebrow="Finance & Settlements"
        icon={Undo2}
        hint="Review customer ticket refund claims. Once approved with an outbound bank transfer reference, held seat inventory is released."
      />

      {error ? (
        <div className="mb-4">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}

      <div className="mt-4">
        {!state ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : state.items?.length === 0 ? (
          <EmptyState
            title="No Pending Refund Requests"
            description="All customer refund submissions have been decided and processed."
          />
        ) : (
          <ul className="grid gap-3.5">
            {state.items?.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-line/70 bg-elevated/80 p-5 shadow-sm backdrop-blur-md transition hover:border-line space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/20">
                      <Receipt className="size-4" />
                    </div>
                    <div>
                      <span className="font-mono text-base font-extrabold text-foreground tracking-wider block">
                        {r.booking.reference}
                      </span>
                      <span className="text-xs text-muted block">{r.booking.movie}</span>
                    </div>
                  </div>

                  <span className="text-lg font-extrabold text-accent">
                    {formatPrice(r.amount)}
                  </span>
                </div>

                <div className="rounded-xl border border-line/50 bg-surface/60 p-3.5 text-xs space-y-1">
                  <p className="font-bold uppercase tracking-wider text-muted text-[10px]">
                    Customer Stated Reason:
                  </p>
                  <p className="italic text-foreground/90 font-medium leading-relaxed">
                    &quot;{r.reason}&quot;
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPayoutRef("");
                      setPayoutTarget(r);
                    }}
                    className="shadow-sm cursor-pointer"
                  >
                    <Check className="size-3.5 mr-1" />
                    <span>Record Payout…</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDenyReason("");
                      setDenyTarget(r);
                    }}
                    className="cursor-pointer"
                  >
                    <X className="size-3.5 mr-1" />
                    <span>Deny Claim…</span>
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
            className="space-y-4"
          >
            <div className="rounded-2xl border border-line/60 bg-surface/50 p-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Refund Amount Due</p>
              <p className="text-2xl font-extrabold text-accent">{formatPrice(payoutTarget.amount)}</p>
              <p className="text-xs text-muted mt-1">{payoutTarget.booking.movie}</p>
            </div>

            <TextField
              id="payout-ref"
              label="Bank Transfer Outbound Reference"
              required
              value={payoutRef}
              onChange={(e) => setPayoutRef(e.target.value)}
              placeholder="e.g. TX-2026-REF8912"
              hint="Outbound wire transaction reference number from corporate banking portal"
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
              <Button type="button" variant="ghost" onClick={() => setPayoutTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={acting || !payoutRef.trim()} className="shadow-sm">
                {acting ? "Recording…" : "Confirm Outbound Payout"}
              </Button>
            </div>
          </form>
        )}
      </AdminModal>

      {/* Deny Refund Modal */}
      <AdminModal
        open={!!denyTarget}
        onClose={() => setDenyTarget(null)}
        title="Deny Refund Claim"
        subtitle={`Booking reference: ${denyTarget?.booking.reference ?? ""}`}
        size="sm"
      >
        {denyTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (denyReason.trim()) void act(() => adminApi.denyRefund(denyTarget.id, denyReason.trim()));
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-line/60 bg-surface/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer Claim</p>
              <p className="text-xs italic text-foreground mt-1">&quot;{denyTarget.reason}&quot;</p>
            </div>

            <TextArea
              id="deny-reason"
              label="Reason for Denial (Sent to Customer)"
              required
              rows={3}
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Explain why this ticket request does not meet cinema cancellation policy…"
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
              <Button type="button" variant="ghost" onClick={() => setDenyTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={acting || !denyReason.trim()}
                className="text-rose-500"
              >
                {acting ? "Denying…" : "Deny Request"}
              </Button>
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

  return (
    <section className="space-y-6">
      <PageTitle
        title="Deposit Bank Accounts & Gateways"
        eyebrow="Finance & Treasury"
        icon={Landmark}
        hint="Customers are displayed active bank transfer deposit accounts on the checkout page when paying via offline bank wire."
        action={
          <Button onClick={() => setOpen(true)} className="shadow-sm">
            <Plus className="size-4 mr-1.5" aria-hidden />
            <span>Add bank account</span>
          </Button>
        }
      />

      <div className="max-w-4xl">
        {!state ? (
          <Skeleton className="h-36 rounded-2xl" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : (
          <ul className="grid gap-3.5">
            {state.items?.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/70 bg-elevated/80 p-5 shadow-sm backdrop-blur-md transition hover:border-line"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/20">
                    <Landmark className="size-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-foreground text-base">
                      {a.bank_name} <span className="text-muted font-normal text-sm">· {a.account_name}</span>
                    </p>
                    <p className="font-mono text-xs font-bold text-accent mt-0.5 tracking-wider">
                      {a.account_number}
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      {a.cinema ? `Assigned to ${a.cinema.name}` : "Available across all cinema venues"}
                      {a.swift ? ` · SWIFT: ${a.swift}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
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
                    className="cursor-pointer shadow-sm text-xs font-semibold"
                  >
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
            {state.items?.length === 0 && (
              <li className="rounded-2xl border border-dashed border-line/70 bg-surface/30 p-8 text-center text-xs text-muted">
                No bank deposit accounts configured yet. Offline wire payments cannot be accepted until at least one account is active.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Add Bank Account Modal */}
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Deposit Bank Account"
        subtitle="Configure receiving bank details for customer offline bank wire transfers"
        size="md"
      >
        <form onSubmit={add} noValidate className="space-y-4" aria-label="Add bank account">
          <TextField
            id="ba-bank_name"
            label="Bank Name"
            placeholder="e.g. KB Kookmin Bank, Shinhan Bank"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            error={errors.bank_name}
          />
          <TextField
            id="ba-account_name"
            label="Account Beneficiary Holder Name"
            placeholder="e.g. AR Entertainment Co., Ltd."
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            error={errors.account_name}
          />
          <TextField
            id="ba-account_number"
            label="Account Number"
            placeholder="e.g. 123-4567-89012"
            value={form.account_number}
            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
            error={errors.account_number}
          />
          <TextField
            id="ba-swift"
            label="SWIFT / BIC Code (Optional)"
            placeholder="e.g. CZNBKRSE"
            value={form.swift}
            onChange={(e) => setForm({ ...form, swift: e.target.value })}
          />
          <TextArea
            id="ba-instructions"
            label="Special Wire Transfer Instructions (Optional)"
            placeholder="e.g. Please put your 6-digit booking code as the wire transfer remark"
            rows={2}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="shadow-sm">
              {busy ? "Saving…" : "Save Bank Account"}
            </Button>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
