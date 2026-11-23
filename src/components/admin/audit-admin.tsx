"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { DataTable, PageTitle, Pager, Pill, Section, TextField, useLoad, when } from "./kit";

interface Log {
  id: number;
  action: string;
  actor: { name: string; email: string } | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  correlation_id: string | null;
  created_at: string;
}

const actionTone = (action: string) => {
  if (action.startsWith("auth.") || action.includes("mfa")) return "purple";
  if (action.startsWith("payment.") || action.startsWith("refund.")) return "accent";
  if (action.startsWith("movie.") || action.startsWith("showtime.")) return "info";
  if (action.startsWith("staff.") || action.startsWith("role.")) return "warn";
  if (action.includes("delete") || action.includes("cancel")) return "bad";
  return "neutral";
};

export function AuditAdmin() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const list = useLoad(
    () => adm.get<Log[]>("/audit-logs", { action, actor, from, to, page, per_page: 50 }),
    `audit-${action}-${actor}-${from}-${to}-${page}`,
  );

  return (
    <section className="space-y-6">
      <PageTitle
        title="Security & Compliance Audit Trail"
        eyebrow="Security & Governance"
        icon={ScrollText}
        hint="Append-only cryptographic audit record of staff actions, permission changes, financial decisions, and data mutations."
      />

      {/* Filter Bar */}
      <div className="rounded-2xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="a-action"
            label="Filter Action Type"
            placeholder="e.g. payment., movie., auth."
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
          <TextField
            id="a-actor"
            label="Actor Email Prefix"
            placeholder="e.g. admin@cineora.com"
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(1);
            }}
          />
          <TextField
            id="a-from"
            label="From Date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <TextField
            id="a-to"
            label="To Date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
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
              rowKey={(l) => String(l.id)}
              empty="No audit log entries match your search criteria."
              columns={[
                {
                  key: "t",
                  label: "Timestamp",
                  className: "whitespace-nowrap text-xs text-muted",
                  render: (l) => when(l.created_at),
                },
                {
                  key: "a",
                  label: "Action",
                  render: (l) => (
                    <Pill tone={actionTone(l.action)} dot={false}>
                      <span className="font-mono text-xs">{l.action}</span>
                    </Pill>
                  ),
                },
                {
                  key: "w",
                  label: "Staff Actor",
                  render: (l) =>
                    l.actor ? (
                      <div className="text-xs">
                        <span className="font-bold text-foreground block">{l.actor.name}</span>
                        <span className="text-muted block">{l.actor.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">System / Automation</span>
                    ),
                },
                {
                  key: "r",
                  label: "Resource Target",
                  render: (l) => (
                    <span className="font-mono text-xs text-foreground/90">
                      {l.resource_type ? `${l.resource_type}: ` : ""}
                      <span className="text-muted font-normal">{l.resource_id ?? "—"}</span>
                    </span>
                  ),
                },
                {
                  key: "m",
                  label: "Payload / Metadata",
                  render: (l) =>
                    l.metadata ? (
                      <code className="block max-w-xs truncate rounded-md bg-surface/80 px-2 py-1 font-mono text-[11px] text-muted border border-line/50">
                        {JSON.stringify(l.metadata)}
                      </code>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    ),
                },
                {
                  key: "i",
                  label: "Client IP",
                  render: (l) => (
                    <span className="font-mono text-[11px] text-muted rounded bg-surface px-1.5 py-0.5 border border-line/40">
                      {l.ip ?? "127.0.0.1"}
                    </span>
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
    </section>
  );
}
