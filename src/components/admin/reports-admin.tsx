"use client";

import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { API_BASE_URL } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { DataTable, PageTitle, Panel, Section, SelectField, TextField, useLoad } from "./kit";

interface Report {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ReportsAdmin() {
  const { can } = useAuth();
  const [type, setType] = useState("bookings");
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [group, setGroup] = useState("day");

  const types = useLoad(
    () => adm.get<{ key: string; label: string }[]>("/reports").then((r) => r.data),
    "report-types",
  );
  const valid = !!from && !!to && from <= to;
  const report = useLoad(
    () =>
      valid
        ? adm.get<Report>(`/reports/${type}`, { from, to, group }).then((r) => r.data)
        : Promise.resolve(undefined),
    `rep-${type}-${from}-${to}-${group}`,
  );

  const csvUrl = `${API_BASE_URL}/api/v1/admin/reports/${type}?from=${from}&to=${to}&group=${group}&format=csv`;

  return (
    <section className="space-y-6">
      <PageTitle
        title="Reports & Analytics"
        eyebrow="Intelligence & Settlement"
        icon={BarChart3}
        hint="Financial revenue, box office admissions, and occupancy calculations calculated across managed venues. Exportable to CSV."
      />

      {/* Filter Bar */}
      <div className="rounded-2xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="r-type"
            label="Report Category"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {types.data?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </SelectField>

          <TextField
            id="r-from"
            label="From Date"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />

          <TextField
            id="r-to"
            label="To Date"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />

          <SelectField
            id="r-group"
            label="Aggregation Period"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="day">By Day</option>
            <option value="month">By Month</option>
          </SelectField>
        </div>

        {!valid && (
          <p role="alert" className="text-xs text-rose-500 font-medium">
            Please choose a start date that occurs on or before the end date.
          </p>
        )}
      </div>

      <Panel>
        <Section loading={report.loading} error={report.error} data={report.data ?? ({ columns: [], rows: [] } as Report)}>
          {(r) => (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
                <span className="text-xs font-semibold text-muted">
                  Showing <strong className="text-foreground">{r.rows.length}</strong> aggregated data points
                </span>

                {can("reports.export") ? (
                  <a
                    href={csvUrl}
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-line/80 bg-surface px-3.5 text-xs font-bold text-foreground hover:border-accent hover:text-accent transition shadow-sm"
                  >
                    <Download className="size-3.5" aria-hidden />
                    <span>Download CSV Export</span>
                  </a>
                ) : (
                  <span className="text-xs text-muted italic">Export requires reports.export permission.</span>
                )}
              </div>

              <DataTable
                rows={r.rows}
                rowKey={(row) => JSON.stringify(row)}
                empty="No report telemetry available for this range."
                columns={r.columns.map((c) => ({
                  key: c.key,
                  label: c.label,
                  className: typeof r.rows[0]?.[c.key] === "number" ? "text-right tabular-nums font-semibold" : undefined,
                  render: (row: Record<string, string | number | null>) =>
                    typeof row[c.key] === "number"
                      ? new Intl.NumberFormat("en-US").format(row[c.key] as number)
                      : (row[c.key] ?? "—"),
                }))}
              />
            </div>
          )}
        </Section>
      </Panel>
    </section>
  );
}
