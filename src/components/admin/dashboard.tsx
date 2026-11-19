"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Clock,
  Film,
  RefreshCw,
  ScanLine,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { PageTitle, Panel, Section, SelectField, StatCard, Pill, useLoad, won } from "./kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Dash {
  total_bookings: number;
  today_bookings: number;
  confirmed_bookings: number;
  pending_verification: number;
  exceptions: number;
  verified_revenue: number;
  upcoming_showtimes: number;
  movies: number;
  cinemas: number;
  ticket_checkins: number;
  trend: { date: string; bookings: number; revenue: number }[];
}

export function Dashboard() {
  const { user, can } = useAuth();
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useLoad(
    () => adm.get<Dash>("/dashboard", { days }).then((r) => r.data),
    `dash-${days}`,
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  if (!can("dashboard.view")) {
    return (
      <section className="py-8">
        <PageTitle
          title={`Welcome, ${user?.name ?? "Staff"}`}
          hint="Use the navigation menu to open areas available to your assigned role."
        />
      </section>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome & Control Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line/70 bg-gradient-to-br from-elevated/90 via-surface/60 to-elevated/40 p-5 sm:p-7 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Sparkles className="size-3" />
              <span>Operations HQ</span>
            </span>
            <span className="text-xs text-muted">· Live Telemetry</span>
          </div>
          <h1 className="display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {greeting}, {user?.name?.split(" ")[0] ?? "Staff"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Overview of live ticketing, verified revenue, and cinema operations across your venues.
          </p>
        </div>

        {/* Trend Range Selector & Refresh */}
        <div className="flex items-center gap-2.5 sm:self-center">
          <div className="flex items-center rounded-xl border border-line/70 bg-surface/80 p-1 shadow-inner">
            {(["7", "30", "90"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  days === d
                    ? "bg-accent text-on-accent shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={reload}
            disabled={loading}
            title="Refresh dashboard metrics"
            className="h-9 px-3"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Quick Operations Toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted shrink-0 mr-1">
          Quick Actions:
        </span>
        {can("tickets.validate") && (
          <Link
            href="/admin/tickets/scan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line/80 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition"
          >
            <ScanLine className="size-3.5 text-accent" />
            <span>Scan Tickets</span>
          </Link>
        )}
        {can("showtimes.manage") && (
          <Link
            href="/admin/showtimes"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line/80 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition"
          >
            <CalendarClock className="size-3.5 text-sky-500" />
            <span>Schedule Showtime</span>
          </Link>
        )}
        {can("movies.view") && (
          <Link
            href="/admin/movies"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line/80 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition"
          >
            <Clapperboard className="size-3.5 text-purple-500" />
            <span>Manage Catalog</span>
          </Link>
        )}
        {can("payments.view") && (
          <Link
            href="/admin/payments"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line/80 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition"
          >
            <Banknote className="size-3.5 text-emerald-500" />
            <span>Payments Queue</span>
          </Link>
        )}
        {can("reports.view") && (
          <Link
            href="/admin/reports"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line/80 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition"
          >
            <BarChart3 className="size-3.5 text-amber-500" />
            <span>Financial Reports</span>
          </Link>
        )}
      </div>

      <Section loading={loading} error={error} data={data}>
        {(d) => {
          const confirmationRate = d.total_bookings > 0
            ? Math.round((d.confirmed_bookings / d.total_bookings) * 100)
            : 0;

          return (
            <div className="space-y-8">
              {/* Alert Banners if payments need attention */}
              {(d.pending_verification > 0 || d.exceptions > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.pending_verification > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
                          <Clock className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {d.pending_verification} Payment{d.pending_verification > 1 ? "s" : ""} Awaiting Review
                          </p>
                          <p className="text-xs opacity-80">Customer bank transfer slips waiting for staff approval</p>
                        </div>
                      </div>
                      <Link
                        href="/admin/payments"
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold hover:bg-amber-500/30 transition"
                      >
                        <span>Review</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  )}

                  {d.exceptions > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-600 dark:text-rose-400">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/20 text-rose-500">
                          <AlertTriangle className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {d.exceptions} Payment Exception{d.exceptions > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs opacity-80">Mismatched amounts or disputed transactions</p>
                        </div>
                      </div>
                      <Link
                        href="/admin/payments?queue=exceptions"
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-bold hover:bg-rose-500/30 transition"
                      >
                        <span>Resolve</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard
                  label="Verified Revenue"
                  value={won(d.verified_revenue)}
                  icon={Banknote}
                  tone="accent"
                  wide
                  subvalue="Confirmed bank & online transactions"
                />

                <StatCard
                  label="Total Bookings"
                  value={d.total_bookings}
                  icon={Ticket}
                  tone="neutral"
                  subvalue={`${d.today_bookings} created today`}
                />

                <StatCard
                  label="Confirmed Bookings"
                  value={d.confirmed_bookings}
                  icon={CheckCircle2}
                  tone="good"
                  subvalue={`${confirmationRate}% completion rate`}
                />

                <StatCard
                  label="Ticket Check-ins"
                  value={d.ticket_checkins}
                  icon={ScanLine}
                  tone="neutral"
                  subvalue="Admitted at cinema doors"
                />

                <StatCard
                  label="Upcoming Showtimes"
                  value={d.upcoming_showtimes}
                  icon={CalendarClock}
                  tone="neutral"
                  subvalue="Scheduled on screens"
                />

                <StatCard
                  label="Published Movies"
                  value={d.movies}
                  icon={Clapperboard}
                  tone="neutral"
                  subvalue="Active catalog titles"
                />

                <StatCard
                  label="Cinemas Active"
                  value={d.cinemas}
                  icon={Building2}
                  tone="neutral"
                  subvalue="Managed venues"
                />

                <StatCard
                  label="Pending Slips"
                  value={d.pending_verification}
                  icon={Clock}
                  tone={d.pending_verification > 0 ? "warn" : "neutral"}
                  subvalue={d.pending_verification > 0 ? "Requires review" : "Queue clear"}
                  action={
                    d.pending_verification > 0 ? (
                      <Link href="/admin/payments" className="text-amber-500 hover:underline">
                        Open queue →
                      </Link>
                    ) : undefined
                  }
                />

                <StatCard
                  label="Payment Exceptions"
                  value={d.exceptions}
                  icon={AlertTriangle}
                  tone={d.exceptions > 0 ? "bad" : "neutral"}
                  subvalue={d.exceptions > 0 ? "Action required" : "Zero errors"}
                  action={
                    d.exceptions > 0 ? (
                      <Link href="/admin/payments?queue=exceptions" className="text-rose-500 hover:underline">
                        Investigate →
                      </Link>
                    ) : undefined
                  }
                />

                <StatCard
                  label="Today's Sales"
                  value={d.today_bookings}
                  icon={TrendingUp}
                  tone="good"
                  subvalue="New bookings today"
                />
              </div>

              {/* Visual Daily Trend Charts */}
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel
                  title="Daily Booking Volume"
                  subtitle={`Past ${days} days booking activity`}
                  icon={Ticket}
                  action={
                    <span className="text-xs font-semibold text-muted">
                      Total: {d.trend.reduce((acc, curr) => acc + curr.bookings, 0)} orders
                    </span>
                  }
                >
                  <ModernBars
                    points={d.trend.map((t) => ({ label: t.date, value: t.bookings }))}
                    unit="bookings"
                  />
                </Panel>

                <Panel
                  title="Daily Confirmed Revenue"
                  subtitle={`Past ${days} days verified settlement`}
                  icon={Banknote}
                  action={
                    <span className="text-xs font-semibold text-accent">
                      Total: {won(d.trend.reduce((acc, curr) => acc + curr.revenue, 0))}
                    </span>
                  }
                >
                  <ModernBars
                    points={d.trend.map((t) => ({ label: t.date, value: t.revenue }))}
                    unit="KRW"
                    money
                  />
                </Panel>
              </div>

              {/* Operational Status & Fast Links */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-card border border-line/70 bg-elevated/70 p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-line/40 pb-3 mb-4">
                    <h3 className="display text-lg text-foreground">Operational Status</h3>
                    <Pill tone="good">All Systems Live</Pill>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-xl border border-line/50 bg-surface/50 p-3.5">
                      <p className="text-xs text-muted">Ticketing Engine</p>
                      <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Ready & On Sale</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/50 bg-surface/50 p-3.5">
                      <p className="text-xs text-muted">Door Scanner Service</p>
                      <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>QR Validation Active</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/50 bg-surface/50 p-3.5">
                      <p className="text-xs text-muted">Bank Transfer Gateway</p>
                      <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Verification Online</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-line/70 bg-elevated/70 p-5 shadow-sm">
                  <div className="border-b border-line/40 pb-3 mb-3">
                    <h3 className="display text-lg text-foreground">Staff Access</h3>
                  </div>
                  <p className="text-xs text-muted">
                    Signed in as <strong className="text-foreground">{user?.email}</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Assigned Roles: <span className="font-semibold text-accent">{user?.roles.join(", ") || "Staff"}</span>
                  </p>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs">
                    <span className="text-muted">Two-Factor Auth:</span>
                    <Pill tone={user?.mfa.enabled ? "good" : "warn"}>
                      {user?.mfa.enabled ? "Enforced" : "Disabled"}
                    </Pill>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </Section>
    </div>
  );
}

/**
 * Modern Interactive Bar Chart with tooltips and clean height scaling
 */
function ModernBars({
  points,
  unit,
  money,
}: {
  points: { label: string; value: number }[];
  unit: string;
  money?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const avg = points.length ? Math.round(total / points.length) : 0;
  const fmt = (n: number) => (money ? won(n) : new Intl.NumberFormat("en-US").format(n));

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <figure className="relative pt-2">
      {/* Dynamic Tooltip Header */}
      <div className="mb-3 flex h-6 items-center justify-between text-xs">
        {activePoint ? (
          <div className="flex items-center gap-2 font-medium">
            <span className="text-foreground font-semibold">{activePoint.label}:</span>
            <span className="font-bold text-accent">{fmt(activePoint.value)}</span>
            <span className="text-muted">({unit})</span>
          </div>
        ) : (
          <div className="text-muted flex items-center gap-2">
            <span>Daily average: <strong className="text-foreground">{fmt(avg)}</strong></span>
          </div>
        )}
        <span className="text-muted">Max day: {fmt(max)}</span>
      </div>

      {/* Bars Container */}
      <div
        className="flex h-44 items-end gap-1 sm:gap-1.5 rounded-xl border border-line/40 bg-surface/40 p-2.5"
        role="img"
        aria-label={`${unit} per day, total ${fmt(total)}`}
      >
        {points.map((p, idx) => {
          const heightPercent = Math.max(4, (p.value / max) * 100);
          const isHovered = hoveredIndex === idx;
          const isHighest = p.value === max && max > 0;

          return (
            <div
              key={p.label}
              className="group relative flex-1 h-full flex items-end justify-center cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className={cn(
                  "w-full rounded-t-sm sm:rounded-t-md transition-all duration-150",
                  isHovered
                    ? "bg-accent shadow-md shadow-accent/30 scale-x-110"
                    : isHighest
                    ? "bg-accent/90"
                    : p.value > 0
                    ? "bg-accent/60 group-hover:bg-accent/90"
                    : "bg-line/40",
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-Axis labels */}
      <figcaption className="mt-2.5 flex justify-between text-[11px] text-muted">
        <span>{points[0]?.label}</span>
        <span className="font-semibold text-foreground">Total: {fmt(total)}</span>
        <span>{points.at(-1)?.label}</span>
      </figcaption>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>{unit} per day</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{fmt(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
