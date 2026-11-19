"use client";

import { useState } from "react";
import { adm } from "@/lib/api/admin";
import { DataTable, PageTitle, Pager, Section, TextField, useLoad, when } from "./kit";

interface Log {
  id: number; action: string; actor: { name: string; email: string } | null; resource_type: string | null; resource_id: string | null;
  metadata: Record<string, unknown> | null; ip: string | null; correlation_id: string | null; created_at: string;
}

export function AuditAdmin() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const list = useLoad(() => adm.get<Log[]>("/audit-logs", { action, actor, from, to, page, per_page: 50 }), `audit-${action}-${actor}-${from}-${to}-${page}`);

  return (
    <section>
      <PageTitle
        title="Security Audit Trail"
        eyebrow="Security & Compliance"
        hint="Append-only cryptographic record of administrative actions, permission grants, and data modifications."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField id="a-action" label="Action starts with" placeholder="payment." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        <TextField id="a-actor" label="Actor email starts with" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} />
        <TextField id="a-from" label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <TextField id="a-to" label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable rows={res.data} rowKey={(l) => String(l.id)} empty="No entries match."
              columns={[
                { key: "t", label: "When", render: (l) => when(l.created_at), className: "whitespace-nowrap" },
                { key: "a", label: "Action", render: (l) => <span className="font-mono text-xs font-bold">{l.action}</span> },
                { key: "w", label: "Who", render: (l) => l.actor ? <span>{l.actor.name}<span className="block text-xs text-muted">{l.actor.email}</span></span> : <span className="text-muted">system / anonymous</span> },
                { key: "r", label: "Resource", render: (l) => <span className="break-all text-xs">{l.resource_type ?? "—"} {l.resource_id ?? ""}</span> },
                { key: "m", label: "Details", render: (l) => l.metadata ? <code className="break-all text-xs text-muted">{JSON.stringify(l.metadata)}</code> : "—" },
                { key: "i", label: "IP", render: (l) => <span className="text-xs">{l.ip ?? "—"}</span> },
              ]} />
            <Pager page={Number(res.meta?.page ?? 1)} last={Number(res.meta?.last_page ?? 1)} onPage={setPage} />
          </>
        )}
      </Section>
    </section>
  );
}
