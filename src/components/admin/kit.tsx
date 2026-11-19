"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Search, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage, inputClass } from "@/components/auth/form-kit";
import { useDialogBehavior, useScrollLock } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/** Loads data for a page section. `reload()` refetches; `loading` is true until the first answer for the current key. */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const full = `${key}#${nonce}`;

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ key: full, data }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key: full,
            error: e instanceof ApiError && e.status === 403 ? "You do not have access to this." : "Could not load. Please try again.",
          });
        }
      });
    return () => controller.abort();
    // `load` is a fresh closure every render; `key` carries the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  const current = state?.key === full ? state : null;
  return { data: current?.data, error: current?.error, loading: current === null, reload: () => setNonce((n) => n + 1) };
}

export function PageTitle({
  title,
  hint,
  action,
  eyebrow,
  breadcrumbs,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  eyebrow?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 text-muted/50" />}
                {b.href ? (
                  <a href={b.href} className="hover:text-foreground">
                    {b.label}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : eyebrow ? (
          <p className="eyebrow mb-1">{eyebrow}</p>
        ) : null}
        <h1 className="display text-3xl tracking-tight sm:text-4xl text-foreground">{title}</h1>
        {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2.5 sm:self-end">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-line/70 bg-elevated/70 shadow-sm backdrop-blur-sm p-5 sm:p-6 transition-all", className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex size-7 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Icon className="size-4" />
              </div>
            )}
            <div>
              {title && <h2 className="display text-xl text-foreground">{title}</h2>}
              {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Modern modal dialog for admin forms, detail sheets, and workflows.
 * Renders on top with backdrop blur, focus trapping, Escape handling, and scroll locking.
 */
export function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "lg",
  zIndex = 50,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  zIndex?: number;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useDialogBehavior(open, onClose, panelRef);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-4xl",
    full: "max-w-6xl",
  }[size];

  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex flex-col w-full max-h-[90vh] rounded-2xl border border-line/80 bg-elevated text-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150",
          sizeClass,
          className,
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4.5 bg-surface/50">
          <div>
            <h2 className="display text-2xl text-foreground font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-none">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral" | "info" | "purple";
  dot?: boolean;
}) {
  const styles = {
    good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    neutral: "bg-foreground/5 text-muted border-line/60",
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  }[tone];

  const dotColor = {
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    bad: "bg-rose-500",
    neutral: "bg-muted",
    info: "bg-sky-500",
    purple: "bg-purple-500",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide", styles)}>
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} aria-hidden />}
      <span>{children}</span>
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/** Responsive modern table: real table on wide screens, scrollable on small ones with hover rows. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  empty?: string;
  onRowClick?: (r: T) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState title={empty} />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line/70 bg-elevated/40 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line/70 bg-surface/80 text-[11px] uppercase tracking-wider text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={cn("transition-colors duration-150", onRowClick && "cursor-pointer hover:bg-surface/70")}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3.5 align-middle text-sm", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section<T>({
  loading,
  error,
  data,
  children,
}: {
  loading: boolean;
  error?: string;
  data: T | undefined;
  children: (d: T) => ReactNode;
}) {
  if (loading) return <Skeleton className="h-48 rounded-card border border-line/40" />;
  if (error || data === undefined) return <FormMessage>{error ?? "Could not load."}</FormMessage>;
  return <>{children(data)}</>;
}

export function Pager({ page, last, onPage }: { page: number; last: number; onPage: (p: number) => void }) {
  if (last <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between border-t border-line/40 pt-3 text-sm" aria-label="Pagination">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-xs text-muted font-medium">
        Page <span className="text-foreground font-semibold">{page}</span> of <span className="text-foreground font-semibold">{last}</span>
      </span>
      <Button size="sm" variant="secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

/** Stat Card component for metrics and KPIs */
export function StatCard({
  label,
  value,
  subvalue,
  icon: Icon,
  tone,
  wide,
  action,
}: {
  label: string;
  value: number | string;
  subvalue?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "good" | "warn" | "bad" | "neutral" | "accent";
  wide?: boolean;
  action?: ReactNode;
}) {
  const toneBorder = {
    good: "border-emerald-500/40 bg-emerald-500/[0.03]",
    warn: "border-amber-500/50 bg-amber-500/[0.04]",
    bad: "border-rose-500/50 bg-rose-500/[0.04]",
    accent: "border-accent/50 bg-accent/[0.04]",
    neutral: "border-line/70 bg-elevated/70",
  }[tone ?? "neutral"];

  const iconBg = {
    good: "bg-emerald-500/15 text-emerald-500",
    warn: "bg-amber-500/15 text-amber-500",
    bad: "bg-rose-500/15 text-rose-500",
    accent: "bg-accent/15 text-accent",
    neutral: "bg-foreground/5 text-muted",
  }[tone ?? "neutral"];

  return (
    <div className={cn("group relative flex flex-col justify-between rounded-card border p-4 sm:p-5 shadow-sm transition hover:shadow-md", toneBorder, wide && "col-span-2 md:col-span-1")}>
      <div className="flex items-start justify-between gap-2">
        <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
        {Icon && (
          <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition", iconBg)}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <dd className="display mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{value}</dd>
      {(subvalue || action) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/30 pt-2 text-xs">
          {subvalue && <span className="text-muted">{subvalue}</span>}
          {action}
        </div>
      )}
    </div>
  );
}

// --- Form fields ------------------------------------------------------------------------------

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  id: string;
}

function Wrap({ id, label, error, hint, children }: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-500 flex items-center gap-1">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, error, hint, id, ...rest }: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={!!error}
        className={cn(
          "h-11 w-full rounded-control border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent",
          error ? "border-rose-500 ring-rose-500/20" : "border-line/70 hover:border-line",
        )}
        {...rest}
      />
    </Wrap>
  );
}

export function TextArea({ label, error, hint, id, ...rest }: BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        aria-invalid={!!error}
        rows={4}
        className={cn(
          "w-full rounded-control border bg-background p-3 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent",
          error ? "border-rose-500 ring-rose-500/20" : "border-line/70 hover:border-line",
        )}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({ label, error, hint, id, children, ...rest }: BaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={!!error}
        className={cn(
          "h-11 w-full rounded-control border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent",
          error ? "border-rose-500 ring-rose-500/20" : "border-line/70 hover:border-line",
        )}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

export function CheckField({ label, id, ...rest }: { label: string; id: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
      <input id={id} type="checkbox" className="size-4 rounded border-line accent-[var(--accent)] transition" {...rest} />
      <span className="font-medium text-foreground">{label}</span>
    </label>
  );
}

/** Field-level errors from a failed request, flattened to the first message per field. */
export function fieldErrors(e: unknown): Record<string, string> {
  return e instanceof ApiError ? Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])) : {};
}

export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.status === 403) return "You do not have permission to do that.";
  if (e.status === 429) return "Too many requests. Please wait a moment.";
  return e.message;
}

export const won = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n);

export const when = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso))
    : "—";

/** A small action-with-feedback helper used by forms: runs `fn`, shows a success note or the error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>, success?: string, flat = false): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setFields({});
    setNote(null);
    try {
      const r = await fn();
      if (success) setNote(success);
      return r;
    } catch (e) {
      const f = fieldErrors(e);
      setFields(f);
      const keys = Object.keys(f);
      const detail = keys.map((k) => f[k]).filter(Boolean).join(" ");
      setError(detail || errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fields, note, run };
}

export function Feedback({ error, note }: { error: string | null; note: string | null }) {
  return (
    <>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {note ? (
        <div role="status" className="flex items-center gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm text-accent-text font-medium">
          <CheckCircle2 className="size-4 shrink-0 text-accent" />
          <span>{note}</span>
        </div>
      ) : null}
    </>
  );
}
