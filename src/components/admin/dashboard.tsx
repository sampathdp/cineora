"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Clock,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { PageTitle, Panel, Section, StatCard, Pill, useLoad, won } from "./kit";
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
          hint="Use the navigation menu to open operational areas available to your assigned role."
        />
      </section>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-200">
      {/* Hero Welcome & Control Bar */}
      <div className="relative overflow-hidden rounded-3xl border border-line/70 bg-gradient-to-br from-elevated/95 via-surface/80 to-elevated/50 p-6 sm:p-8 shadow-sm backdrop-blur-md">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 -bottom-20 size-60 rounded-full bg-sky-500/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-0.5 text-xs font-semibold text-accent shadow-sm">
                <Sparkles className="size-3" />
                <span>Operations HQ</span>
              </span>
              <span className="text-xs text-muted">· Live Telemetry & Control Hub</span>
            </div>
            <h1 className="display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {greeting}, {user?.name?.split(" ")[0] ?? "Staff"}
            </h1>
            <p className="mt-1 text-sm text-muted max-w-2xl leading-relaxed">
              Real-time monitoring of ticket sales, box office check-ins, verified bank settlements, and venue screenings.
            </p>
          </div>

          {/* Trend Range Selector & Refresh */}
          <div className="flex items-center gap-3 shrink-0 sm:self-center">
            <div className="flex items-center rounded-2xl border border-line/80 bg-surface/80 p-1 shadow-inner backdrop-blur-sm">
              {(["7", "30", "90"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                    days === d
                      ? "bg-accent text-on-accent shadow-sm font-bold"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {d} Days
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={reload}
              disabled={loading}
              title="Refresh dashboard metrics"
              className="h-9 px-3.5 rounded-xl cursor-pointer shadow-sm hover:border-accent"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
              <span className="text-xs font-semibold">Sync</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Operations Toolbar */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0 mr-1 flex items-center gap-1">
          <span>Shortcuts:</span>
        </span>
        {can("tickets.validate") && (
          <Link
            href="/admin/tickets/scan"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-elevated/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition duration-150"
          >
            <ScanLine className="size-3.5 text-accent" />
            <span>Scan Tickets</span>
          </Link>
        )}
        {can("showtimes.manage") && (
          <Link
            href="/admin/showtimes"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-elevated/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition duration-150"
          >
            <CalendarClock className="size-3.5 text-sky-500" />
            <span>Schedule Showtime</span>
          </Link>
        )}
        {can("movies.view") && (
          <Link
            href="/admin/movies"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-elevated/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition duration-150"
          >
            <Clapperboard className="size-3.5 text-purple-500" />
            <span>Manage Catalog</span>
          </Link>
        )}
        {can("payments.view") && (
          <Link
            href="/admin/payments"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-elevated/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition duration-150"
          >
            <Banknote className="size-3.5 text-emerald-500" />
            <span>Payments Queue</span>
          </Link>
        )}
        {can("reports.view") && (
          <Link
            href="/admin/reports"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-elevated/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-accent hover:text-accent transition duration-150"
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
                <div className="grid gap-3 sm:grid-cols-2 animate-in fade-in">
                  {d.pending_verification > 0 && (
                    <div className="flex items-center justify-between rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 shadow-inner">
                          <Clock className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {d.pending_verification} Payment{d.pending_verification > 1 ? "s" : ""} Awaiting Review
                          </p>
                          <p className="text-xs opacity-85">Customer bank transfer slips waiting for staff approval</p>
                        </div>
                      </div>
                      <Link
                        href="/admin/payments"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3.5 py-2 text-xs font-bold hover:bg-amber-500/30 transition shadow-sm"
                      >
                        <span>Review</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  )}

                  {d.exceptions > 0 && (
                    <div className="flex items-center justify-between rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-rose-600 dark:text-rose-400 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500 shadow-inner">
                          <AlertTriangle className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {d.exceptions} Payment Exception{d.exceptions > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs opacity-85">Mismatched amounts or disputed transactions</p>
                        </div>
                      </div>
                      <Link
                        href="/admin/payments?queue=exceptions"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3.5 py-2 text-xs font-bold hover:bg-rose-500/30 transition shadow-sm"
                      >
                        <span>Resolve</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Primary KPI Grid */}
              <section aria-label="Key figures" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
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
                      <Link href="/admin/payments" className="text-amber-500 hover:underline font-semibold">
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
                      <Link href="/admin/payments?queue=exceptions" className="text-rose-500 hover:underline font-semibold">
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
              </section>

              {/* Visual Daily Trend Charts */}
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel
                  title="Daily Booking Volume"
                  subtitle={`Past ${days} days booking activity`}
                  icon={Ticket}
                  action={
                    <span className="rounded-full border border-line/60 bg-surface/80 px-2.5 py-1 text-xs font-semibold text-muted">
                      Total: <strong className="text-foreground">{d.trend.reduce((acc, curr) => acc + curr.bookings, 0)}</strong> orders
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
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
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
                <div className="rounded-2xl border border-line/70 bg-elevated/70 p-6 shadow-sm backdrop-blur-md lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-line/40 pb-4 mb-5">
                    <div>
                      <h3 className="display text-lg font-bold text-foreground">Operational Status</h3>
                      <p className="text-xs text-muted">Real-time health of core cinema microservices</p>
                    </div>
                    <Pill tone="good">All Systems Live</Pill>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-xl border border-line/60 bg-surface/60 p-4 transition hover:border-line">
                      <p className="text-xs text-muted font-medium">Ticketing Engine</p>
                      <p className="mt-1.5 font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Ready & On Sale</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/60 bg-surface/60 p-4 transition hover:border-line">
                      <p className="text-xs text-muted font-medium">Door Scanner Service</p>
                      <p className="mt-1.5 font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>QR Validation Active</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/60 bg-surface/60 p-4 transition hover:border-line">
                      <p className="text-xs text-muted font-medium">Bank Transfer Gateway</p>
                      <p className="mt-1.5 font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>Verification Online</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-line/70 bg-elevated/70 p-6 shadow-sm backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-line/40 pb-4 mb-4">
                      <ShieldCheck className="size-5 text-accent" />
                      <h3 className="display text-lg font-bold text-foreground">Staff Access</h3>
                    </div>
                    <p className="text-xs text-muted">
                      Active Account: <strong className="text-foreground">{user?.email}</strong>
                    </p>
                    <p className="mt-1.5 text-xs text-muted">
                      Assigned Roles: <span className="font-bold text-accent">{user?.roles.join(", ") || "Staff"}</span>
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-line/40 flex items-center justify-between text-xs">
                    <span className="text-muted font-medium">Two-Factor Auth:</span>
                    <Pill tone={user?.mfa.enabled ? "good" : "warn"}>
                      {user?.mfa.enabled ? "Enforced & Active" : "Disabled"}
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
 * Modern Interactive Bar Chart with tooltips, smooth hover states, and clean height scaling
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
      <div className="mb-3 flex h-7 items-center justify-between text-xs">
        {activePoint ? (
          <div className="flex items-center gap-2 font-medium animate-in fade-in">
            <span className="text-foreground font-semibold">{activePoint.label}:</span>
            <span className="font-extrabold text-accent">{fmt(activePoint.value)}</span>
            <span className="text-muted">({unit})</span>
          </div>
        ) : (
          <div className="text-muted flex items-center gap-2">
            <span>Daily average: <strong className="text-foreground font-semibold">{fmt(avg)}</strong></span>
          </div>
        )}
        <span className="text-muted text-[11px]">Peak: <strong className="text-foreground">{fmt(max)}</strong></span>
      </div>

      {/* Bars Container */}
      <div
        className="flex h-44 items-end gap-1 sm:gap-1.5 rounded-2xl border border-line/50 bg-surface/50 p-3 backdrop-blur-sm"
        role="img"
        aria-label={`${unit} per day, total ${fmt(total)}`}
      >
        {points.map((p, idx) => {
          const heightPercent = Math.max(5, (p.value / max) * 100);
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
                  "w-full rounded-t-md transition-all duration-200",
                  isHovered
                    ? "bg-accent shadow-lg shadow-accent/40 scale-x-110"
                    : isHighest
                    ? "bg-gradient-to-t from-accent to-accent-hover shadow-sm"
                    : p.value > 0
                    ? "bg-accent/70 hover:bg-accent"
                    : "bg-line/30",
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-Axis labels */}
      <figcaption className="mt-3 flex justify-between text-[11px] text-muted">
        <span>{points[0]?.label}</span>
        <span className="font-bold text-foreground">Total: {fmt(total)}</span>
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
