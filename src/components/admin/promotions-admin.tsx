"use client";

import { useState } from "react";
import { Check, Copy, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Pill, Section, SelectField, TextField, useAction, useLoad, won } from "./kit";
import { confirmDialog } from "@/components/ui/dialogs";

interface Promo {
  id: number;
  code: string;
  type: "fixed" | "percent";
  value: number;
  min_amount: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  is_active: boolean;
}

export function PromotionsAdmin() {
  const list = useLoad(() => adm.get<Promo[]>("/promotions").then((r) => r.data), "promos");
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    code: "",
    type: "percent",
    value: "10",
    min_amount: "0",
    max_discount: "",
    usage_limit: "",
    per_user_limit: "1",
    ends_at: "",
    is_active: true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const num = (s: string) => (s === "" ? null : Number(s));
    const ok = await act.run(
      () =>
        adm.post("/promotions", {
          code: f.code.toUpperCase().trim(),
          type: f.type,
          value: Number(f.value),
          min_amount: Number(f.min_amount || 0),
          max_discount: num(f.max_discount),
          usage_limit: num(f.usage_limit),
          per_user_limit: num(f.per_user_limit),
          ends_at: f.ends_at || null,
          is_active: f.is_active,
        }),
      "Promotion code created.",
    );
    if (ok) {
      setF({ ...f, code: "" });
      setOpen(false);
      list.reload();
    }
  }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Promotions & Discount Codes"
        eyebrow="Commerce & Marketing"
        icon={Percent}
        hint="Manage promotional discount vouchers, redemption rules, cart limits, and campaign expiration dates."
        action={
          <Button onClick={() => setOpen(true)} className="shadow-sm">
            <Plus className="size-4 mr-1.5" aria-hidden />
            <span>New promo code</span>
          </Button>
        }
      />

      <Feedback error={act.error} note={act.note} />

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(p) => String(p.id)}
            empty="No promotion discount codes configured yet."
            columns={[
              {
                key: "c",
                label: "Promo Code",
                render: (p) => (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-foreground text-sm tracking-wider rounded-lg bg-surface/80 border border-line/60 px-2.5 py-1">
                      {p.code}
                    </span>
                  </div>
                ),
              },
              {
                key: "v",
                label: "Discount Value",
                render: (p) => (
                  <span className="font-bold text-accent">
                    {p.type === "percent"
                      ? `${p.value}% OFF${p.max_discount ? ` (Max ${won(p.max_discount)})` : ""}`
                      : `${won(p.value)} OFF`}
                  </span>
                ),
              },
              {
                key: "m",
                label: "Minimum Spend",
                render: (p) => <span className="text-xs text-muted">{won(p.min_amount)}</span>,
              },
              {
                key: "u",
                label: "Usage Tracking",
                render: (p) => (
                  <span className="text-xs font-semibold text-foreground">
                    {p.used_count} redeemed
                    {p.usage_limit ? ` of ${p.usage_limit}` : " (unlimited)"}
                  </span>
                ),
              },
              {
                key: "a",
                label: "Status",
                render: (p) => (
                  <Pill tone={p.is_active ? "good" : "neutral"}>
                    {p.is_active ? "Active" : "Inactive"}
                  </Pill>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (p) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (
                          await act.run(
                            () => adm.patch(`/promotions/${p.id}`, { is_active: !p.is_active }),
                            p.is_active ? "Turned off." : "Turned on.",
                          )
                        ) {
                          list.reload();
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if ((await confirmDialog({ title: `Delete promo code ${p.code}?`, message: "Customers can no longer use it.", confirmLabel: "Delete", danger: true }))) {
                          if (await act.run(() => adm.del(`/promotions/${p.id}`), "Promo deleted.")) {
                            list.reload();
                          }
                        }
                      }}
                      className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                      aria-label={`Delete ${p.code}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Section>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Promotional Code"
        subtitle="Configure discount amount, cart minimums, usage caps, and expiration"
        size="lg"
      >
        <form onSubmit={create} noValidate className="space-y-5" aria-label="New promo code">
          <Feedback error={act.error} note={act.note} />

          <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="p-code"
                label="Promo Code Voucher"
                placeholder="e.g. SUMMER2026, VIP10"
                value={f.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                error={act.fields.code}
                hint="Alphanumeric characters. Auto-capitalized."
              />
              <SelectField
                id="p-type"
                label="Discount Calculation"
                value={f.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="percent">Percentage Off (%)</option>
                <option value="fixed">Fixed Won Deduction (KRW)</option>
              </SelectField>

              <TextField
                id="p-val"
                label={f.type === "percent" ? "Discount Percentage (1 to 100)" : "Deduction Amount (KRW)"}
                inputMode="numeric"
                value={f.value}
                onChange={(e) => set("value", e.target.value)}
                error={act.fields.value}
              />
              <TextField
                id="p-min"
                label="Minimum Order Subtotal (KRW)"
                inputMode="numeric"
                value={f.min_amount}
                onChange={(e) => set("min_amount", e.target.value)}
                error={act.fields.min_amount}
              />

              <TextField
                id="p-max"
                label="Max Discount Cap (KRW, optional)"
                inputMode="numeric"
                placeholder="Leave blank for uncapped"
                value={f.max_discount}
                onChange={(e) => set("max_discount", e.target.value)}
              />
              <TextField
                id="p-use"
                label="Total Campaign Redemptions Cap"
                inputMode="numeric"
                placeholder="e.g. 500 uses"
                value={f.usage_limit}
                onChange={(e) => set("usage_limit", e.target.value)}
              />

              <TextField
                id="p-user"
                label="Allowed Uses Per Customer"
                inputMode="numeric"
                value={f.per_user_limit}
                onChange={(e) => set("per_user_limit", e.target.value)}
              />
              <TextField
                id="p-end"
                label="Campaign Expiry Date (Optional)"
                type="date"
                value={f.ends_at}
                onChange={(e) => set("ends_at", e.target.value)}
                error={act.fields.ends_at}
              />
            </div>

            <div className="pt-2">
              <CheckField
                id="p-act"
                label="Make promotional code active for checkout immediately"
                checked={f.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={act.busy || !f.code} className="shadow-sm">
              {act.busy ? "Creating…" : "Create Promotion"}
            </Button>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
