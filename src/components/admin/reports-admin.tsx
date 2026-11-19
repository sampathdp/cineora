"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { API_BASE_URL } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { DataTable, PageTitle, Panel, Section, SelectField, TextField, useLoad } from "./kit";

interface Report { columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[] }

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ReportsAdmin() {
  const { can } = useAuth();
  const [type, setType] = useState("bookings");
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [group, setGroup] = useState("day");
  const types = useLoad(() => adm.get<{ key: string; label: string }[]>("/reports").then((r) => r.data), "report-types");
  const valid = !!from && !!to && from <= to;
  const report = useLoad(() => (valid ? adm.get<Report>(`/reports/${type}`, { from, to, group }).then((r) => r.data) : Promise.resolve(undefined)), `rep-${type}-${from}-${to}-${group}`);

  // The CSV is fetched by the browser with the session cookie (a plain link would work too); it needs reports.export.
  const csvUrl = `${API_BASE_URL}/api/v1/admin/reports/${type}?from=${from}&to=${to}&group=${group}&format=csv`;

  return (
    <section>
      <PageTitle
        title="Reports & Analytics"
        eyebrow="Intelligence & Settlement"
        hint="Financial, attendance, and occupancy reports calculated across your managed venues. Exportable to CSV."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField id="r-type" label="Report" value={type} onChange={(e) => setType(e.target.value)}>
          {types.data?.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </SelectField>
        <TextField id="r-from" label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <TextField id="r-to" label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <SelectField id="r-group" label="Group by" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="day">Day</option>
          <option value="month">Month</option>
        </SelectField>
      </div>
      {!valid ? <p role="alert" className="text-sm text-red-500">Choose a start date that is not after the end date.</p> : null}
      <Panel>
        <Section loading={report.loading} error={report.error} data={report.data ?? ({ columns: [], rows: [] } as Report)}>
          {(r) => (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted">{r.rows.length} rows</p>
                {can("reports.export") ? (
                  <a href={csvUrl} className="inline-flex min-h-9 items-center gap-2 rounded-control border border-line px-3 text-sm font-semibold hover:border-accent"><Download className="size-4" aria-hidden /> Download CSV</a>
                ) : <span className="text-xs text-muted">Export needs extra permission.</span>}
              </div>
              <DataTable rows={r.rows} rowKey={(row) => JSON.stringify(row)} empty="No data in this range."
                columns={r.columns.map((c) => ({ key: c.key, label: c.label, className: typeof r.rows[0]?.[c.key] === "number" ? "text-right tabular-nums" : undefined, render: (row: Record<string, string | number | null>) => (typeof row[c.key] === "number" ? new Intl.NumberFormat("en-US").format(row[c.key] as number) : (row[c.key] ?? "—")) }))} />
            </>
          )}
        </Section>
      </Panel>
    </section>
  );
}
