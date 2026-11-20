"use client";

import { useState } from "react";
import { Mail, Phone, Ticket, User, Users } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, PageTitle, Pager, Pill, Section, TextField, useLoad, when, won } from "./kit";

interface Customer {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  is_active: boolean;
  joined_at: string;
  bookings: number;
}
interface Detail extends Customer {
  phone: string | null;
  recent_bookings: { id: string; reference: string; status: string; total: number; movie: string | null }[];
}

export function CustomersAdmin() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(
    () => adm.get<Customer[]>("/customers", { q, page, per_page: 25 }),
    `cu-${q}-${page}`,
  );
  const detail = useLoad(
    () => (selected ? adm.get<Detail>(`/customers/${selected}`).then((r) => r.data) : Promise.resolve(undefined)),
    `cu-d-${selected}`,
  );

  return (
    <section className="space-y-6">
      <PageTitle
        title="Customer Directory"
        eyebrow="Users & Access"
        icon={Users}
        hint="Search registered customer accounts, verify contact emails, and review historical cinema ticket bookings. All profile accesses are audited."
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm max-w-xl">
        <div className="flex-1">
          <TextField
            id="cq"
            label="Search Customer"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable
              rows={res.data}
              rowKey={(c) => c.id}
              onRowClick={(c) => setSelected(c.id)}
              empty="No customers found matching your query."
              columns={[
                {
                  key: "n",
                  label: "Customer Name",
                  render: (c) => (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold text-xs border border-accent/20">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-foreground block">{c.name}</span>
                        <span className="text-xs text-muted block">{c.email}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "v",
                  label: "Email Verification",
                  render: (c) => (
                    <Pill tone={c.email_verified ? "good" : "warn"}>
                      {c.email_verified ? "Verified" : "Unverified"}
                    </Pill>
                  ),
                },
                {
                  key: "b",
                  label: "Bookings",
                  render: (c) => (
                    <span className="rounded-full border border-line/70 bg-surface/80 px-2.5 py-0.5 text-xs font-bold text-foreground">
                      {c.bookings} orders
                    </span>
                  ),
                },
                {
                  key: "j",
                  label: "Registered",
                  render: (c) => <span className="text-xs text-muted">{when(c.joined_at)}</span>,
                },
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
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                      >
                        <User className="size-3.5 mr-1" />
                        <span>Profile</span>
                      </Button>
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

      {selected && (
        <AdminModal
          open={true}
          onClose={() => setSelected(null)}
          title="Customer Profile"
          subtitle="Customer identity, verified status, and booking history"
          size="lg"
        >
          <Section loading={detail.loading} error={detail.error} data={detail.data}>
            {(c) => (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex items-center justify-between rounded-2xl border border-line/70 bg-surface/50 p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent font-extrabold text-base shadow-sm">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="display text-xl font-extrabold text-foreground">{c.name}</h3>
                      <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span>{c.email}</span>
                        {c.phone && <span>· {c.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <Pill tone={c.email_verified ? "good" : "warn"}>
                    {c.email_verified ? "Email Verified" : "Unverified"}
                  </Pill>
                </div>

                {/* Booking History */}
                <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                    <span>Recent Bookings ({c.recent_bookings.length})</span>
                  </h4>
                  <ul className="divide-y divide-line/40 rounded-xl border border-line/60 bg-elevated/70">
                    {c.recent_bookings.map((b) => (
                      <li key={b.id} className="flex justify-between items-center py-3 px-4 text-xs">
                        <div>
                          <span className="font-mono font-extrabold text-foreground tracking-wider">
                            {b.reference}
                          </span>
                          <span className="text-muted ml-2 font-medium">{b.movie}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-accent">{won(b.total)}</span>
                          <span className="text-muted capitalize">· {b.status.replaceAll("_", " ").toLowerCase()}</span>
                        </div>
                      </li>
                    ))}
                    {c.recent_bookings.length === 0 && (
                      <li className="py-6 text-center text-xs text-muted italic">No booking records found for this customer.</li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-end pt-3 border-t border-line/60">
                  <Button variant="ghost" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </Section>
        </AdminModal>
      )}
    </section>
  );
}
