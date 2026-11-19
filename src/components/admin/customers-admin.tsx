"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, PageTitle, Panel, Pager, Pill, Section, TextField, useLoad, when, won } from "./kit";

interface Customer { id: string; name: string; email: string; email_verified: boolean; is_active: boolean; joined_at: string; bookings: number }
interface Detail extends Customer { phone: string | null; recent_bookings: { id: string; reference: string; status: string; total: number; movie: string | null }[] }

export function CustomersAdmin() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => adm.get<Customer[]>("/customers", { q, page, per_page: 25 }), `cu-${q}-${page}`);
  const detail = useLoad(() => (selected ? adm.get<Detail>(`/customers/${selected}`).then((r) => r.data) : Promise.resolve(undefined)), `cu-d-${selected}`);

  return (
    <section>
      <PageTitle
        title="Customer Directory"
        eyebrow="Users & Access"
        hint="Search customer accounts and review historical cinema bookings. Access to profile details is recorded in the audit trail."
      />
      <div className="mb-4 max-w-md"><TextField id="cq" label="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable rows={res.data} rowKey={(c) => c.id} onRowClick={(c) => setSelected(c.id)} empty="No customers found."
              columns={[
                { key: "n", label: "Name", render: (c) => <span className="font-semibold">{c.name}</span> },
                { key: "e", label: "Email", render: (c) => c.email },
                { key: "v", label: "Verified", render: (c) => <Pill tone={c.email_verified ? "good" : "warn"}>{c.email_verified ? "yes" : "no"}</Pill> },
                { key: "b", label: "Bookings", render: (c) => c.bookings },
                { key: "j", label: "Joined", render: (c) => when(c.joined_at) },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  render: (c) => (
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(c.id)}
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                      >
                        <User className="size-3.5 mr-1" />
                        <span>Profile</span>
                      </Button>
                    </div>
                  ),
                },
              ]} />
            <Pager page={Number(res.meta?.page ?? 1)} last={Number(res.meta?.last_page ?? 1)} onPage={setPage} />
          </>
        )}
      </Section>
      {selected ? (
        <AdminModal
          open={true}
          onClose={() => setSelected(null)}
          title="Customer Profile"
          subtitle="Customer identity, verified status, and booking history"
          size="lg"
        >
          <Section loading={detail.loading} error={detail.error} data={detail.data}>
            {(c) => (
              <div className="grid gap-4 text-sm">
                <div className="border-b border-line/40 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="display text-3xl font-bold">{c.name}</p>
                    <Pill tone={c.email_verified ? "good" : "warn"}>
                      {c.email_verified ? "Email Verified" : "Unverified"}
                    </Pill>
                  </div>
                  <p className="text-muted mt-1">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Recent Bookings ({c.recent_bookings.length})</h4>
                  <ul className="divide-y divide-line/60 rounded-xl border border-line/70 bg-surface/40 p-2">
                    {c.recent_bookings.map((b) => (
                      <li key={b.id} className="flex justify-between items-center py-2 px-2 text-xs">
                        <span className="font-mono font-bold text-foreground">
                          {b.reference} <span className="font-sans text-muted font-normal ml-2">{b.movie}</span>
                        </span>
                        <span className="font-semibold text-accent">{won(b.total)} · <span className="text-muted font-normal capitalize">{b.status.replaceAll("_", " ").toLowerCase()}</span></span>
                      </li>
                    ))}
                    {c.recent_bookings.length === 0 ? <li className="py-3 text-center text-muted">No bookings recorded.</li> : null}
                  </ul>
                </div>
                <div className="flex justify-end pt-3 border-t border-line/40">
                  <button className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:text-foreground" onClick={() => setSelected(null)}>Close</button>
                </div>
              </div>
            )}
          </Section>
        </AdminModal>
      ) : null}
    </section>
  );
}
