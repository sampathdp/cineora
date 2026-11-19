"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Pill, Section, SelectField, TextField, useAction, useLoad, won } from "./kit";

interface Promo {
  id: number; code: string; type: "fixed" | "percent"; value: number; min_amount: number; max_discount: number | null; starts_at: string | null; ends_at: string | null;
  usage_limit: number | null; per_user_limit: number | null; used_count: number; is_active: boolean;
}

export function PromotionsAdmin() {
  const list = useLoad(() => adm.get<Promo[]>("/promotions").then((r) => r.data), "promos");
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", type: "percent", value: "10", min_amount: "0", max_discount: "", usage_limit: "", per_user_limit: "1", ends_at: "", is_active: true });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const num = (s: string) => (s === "" ? null : Number(s));
    const ok = await act.run(() => adm.post("/promotions", {
      code: f.code, type: f.type, value: Number(f.value), min_amount: Number(f.min_amount || 0), max_discount: num(f.max_discount), usage_limit: num(f.usage_limit),
      per_user_limit: num(f.per_user_limit), ends_at: f.ends_at || null, is_active: f.is_active,
    }), "Promo code created.");
    if (ok) { setF({ ...f, code: "" }); setOpen(false); list.reload(); }
  }

  return (
    <section>
      <PageTitle
        title="Promotions & Discounts"
        eyebrow="Commerce & Marketing"
        hint="Manage discount promo codes, usage limits, and redemption rules applied at checkout."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New promo code
          </Button>
        }
      />
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(p) => String(p.id)} empty="No promo codes yet."
            columns={[
              { key: "c", label: "Code", render: (p) => <span className="font-mono font-bold">{p.code}</span> },
              { key: "v", label: "Discount", render: (p) => (p.type === "percent" ? `${p.value}%${p.max_discount ? ` (max ${won(p.max_discount)})` : ""}` : won(p.value)) },
              { key: "m", label: "Minimum", render: (p) => won(p.min_amount) },
              { key: "u", label: "Used", render: (p) => `${p.used_count}${p.usage_limit ? ` / ${p.usage_limit}` : ""}` },
              { key: "a", label: "Status", render: (p) => <Pill tone={p.is_active ? "good" : "neutral"}>{p.is_active ? "active" : "off"}</Pill> },
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
                        if (await act.run(() => adm.patch(`/promotions/${p.id}`, { is_active: !p.is_active }), p.is_active ? "Turned off." : "Turned on.")) {
                          list.reload();
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (window.confirm(`Delete promotion code "${p.code}"?`)) {
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
            ]} />
        )}
      </Section>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="New Promo Code"
        subtitle="Create discount voucher, set percentage or fixed value, and configure usage limits"
        size="lg"
      >
        <form onSubmit={create} noValidate className="grid gap-4 sm:grid-cols-2" aria-label="New promo code">
          <div className="sm:col-span-2"><Feedback error={act.error} note={act.note} /></div>
          <TextField id="p-code" label="Code" value={f.code} onChange={(e) => set("code", e.target.value)} error={act.fields.code} hint="Letters, digits, dash. Saved in capitals." />
          <SelectField id="p-type" label="Type" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed amount (KRW)</option></SelectField>
          <TextField id="p-val" label={f.type === "percent" ? "Percent off (1 to 100)" : "Amount off (KRW)"} inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value)} error={act.fields.value} />
          <TextField id="p-min" label="Minimum order (KRW)" inputMode="numeric" value={f.min_amount} onChange={(e) => set("min_amount", e.target.value)} error={act.fields.min_amount} />
          <TextField id="p-max" label="Maximum discount (KRW, optional)" inputMode="numeric" value={f.max_discount} onChange={(e) => set("max_discount", e.target.value)} />
          <TextField id="p-use" label="Total uses (optional)" inputMode="numeric" value={f.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} />
          <TextField id="p-user" label="Uses per customer" inputMode="numeric" value={f.per_user_limit} onChange={(e) => set("per_user_limit", e.target.value)} />
          <TextField id="p-end" label="Valid until (optional)" type="date" value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} error={act.fields.ends_at} />
          <CheckField id="p-act" label="Active" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-line/40">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={act.busy || !f.code}>{act.busy ? "Creating…" : "Create promo code"}</Button>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
