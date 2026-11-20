"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
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
  icon: Icon,
  breadcrumbs,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  eyebrow?: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="relative mb-8 flex flex-col gap-4 border-b border-line/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 text-muted/40" />}
                {b.href ? (
                  <a href={b.href} className="transition hover:text-foreground">
                    {b.label}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : eyebrow ? (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
              <Sparkles className="size-2.5" />
              <span>{eyebrow}</span>
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20 shadow-sm">
              <Icon className="size-5" />
            </div>
          )}
          <div>
            <h1 className="display text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              {title}
            </h1>
            {hint ? <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">{hint}</p> : null}
          </div>
        </div>
      </div>

      {action ? (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 sm:self-end">
          {action}
        </div>
      ) : null}
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
    <section className={cn("group relative rounded-2xl border border-line/70 bg-elevated/70 shadow-sm backdrop-blur-md p-5 sm:p-6 transition-all duration-200 hover:border-line hover:shadow-md", className)}>
      {/* Top subtle highlight glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {title || action ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Icon className="size-4" />
              </div>
            )}
            <div>
              {title && <h2 className="display text-lg font-bold text-foreground tracking-tight">{title}</h2>}
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
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
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
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
        {/* Top subtle orange highlight glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/20 via-accent to-accent/20" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4.5 bg-surface/60">
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
        <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
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
  tone?: "good" | "warn" | "bad" | "neutral" | "info" | "purple" | "accent";
  dot?: boolean;
}) {
  const styles = {
    good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    neutral: "bg-foreground/5 text-muted border-line/70",
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    accent: "bg-accent/10 text-accent border-accent/30",
  }[tone];

  const dotColor = {
    good: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    warn: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    bad: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
    neutral: "bg-muted",
    info: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]",
    purple: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
    accent: "bg-accent shadow-[0_0_8px_rgba(233,111,37,0.5)]",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide capitalize", styles)}>
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
    <div className="overflow-x-auto rounded-2xl border border-line/70 bg-elevated/40 shadow-sm backdrop-blur-sm [scrollbar-width:thin]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line/70 bg-surface/85 text-[11px] font-semibold uppercase tracking-wider text-muted backdrop-blur-sm">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3.5", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={cn("group transition-colors duration-150", onRowClick ? "cursor-pointer hover:bg-surface/80 dark:hover:bg-surface/50" : "hover:bg-surface/40")}
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
  if (loading) return <Skeleton className="h-48 rounded-2xl border border-line/40" />;
  if (error || data === undefined) return <FormMessage>{error ?? "Could not load."}</FormMessage>;
  return <>{children(data)}</>;
}

export function Pager({ page, last, onPage }: { page: number; last: number; onPage: (p: number) => void }) {
  if (last <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between border-t border-line/40 pt-4 text-sm" aria-label="Pagination">
      <Button
        size="sm"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="flex items-center gap-1.5"
      >
        <ChevronLeft className="size-3.5" />
        <span>Previous</span>
      </Button>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-line/60 bg-surface/80 px-3 py-1 text-xs text-muted font-medium">
          Page <strong className="text-foreground font-bold">{page}</strong> of <strong className="text-foreground font-bold">{last}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={page >= last}
        onClick={() => onPage(page + 1)}
        className="flex items-center gap-1.5"
      >
        <span>Next</span>
        <ChevronRight className="size-3.5" />
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
    good: "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50",
    warn: "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50",
    bad: "border-rose-500/30 bg-rose-500/[0.04] hover:border-rose-500/50",
    accent: "border-accent/40 bg-accent/[0.04] hover:border-accent/60",
    neutral: "border-line/70 bg-elevated/70 hover:border-line",
  }[tone ?? "neutral"];

  const iconBg = {
    good: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
    warn: "bg-amber-500/15 text-amber-500 border border-amber-500/20",
    bad: "bg-rose-500/15 text-rose-500 border border-rose-500/20",
    accent: "bg-accent/15 text-accent border border-accent/25",
    neutral: "bg-foreground/5 text-muted border border-line/50",
  }[tone ?? "neutral"];

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md",
        toneBorder,
        wide && "col-span-2 md:col-span-1",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
        {Icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105", iconBg)}>
            <Icon className="size-4.5" />
          </div>
        )}
      </div>

      <dd className="display mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl tabular-nums">
        {value}
      </dd>

      {(subvalue || action) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/30 pt-2.5 text-xs">
          {subvalue && <span className="text-muted leading-tight">{subvalue}</span>}
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
        <p role="alert" className="mt-1 text-xs font-medium text-rose-500 flex items-center gap-1 animate-in fade-in">
          <AlertCircle className="size-3 shrink-0" />
          <span>{error}</span>
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
          "h-11 w-full rounded-xl border bg-background/80 px-3.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20",
          error ? "border-rose-500 ring-2 ring-rose-500/20" : "border-line/70 hover:border-line",
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
          "w-full rounded-xl border bg-background/80 p-3.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 [scrollbar-width:thin]",
          error ? "border-rose-500 ring-2 ring-rose-500/20" : "border-line/70 hover:border-line",
        )}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({ label, error, hint, id, children, ...rest }: BaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border bg-background/80 px-3.5 pr-9 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 cursor-pointer",
            error ? "border-rose-500 ring-2 ring-rose-500/20" : "border-line/70 hover:border-line",
          )}
          {...rest}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <ChevronRight className="size-4 rotate-90" />
        </div>
      </div>
    </Wrap>
  );
}

export function CheckField({ label, id, ...rest }: { label: string; id: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm select-none py-1">
      <input
        id={id}
        type="checkbox"
        className="size-4 rounded-md border-line/80 text-accent accent-[var(--accent)] transition focus:ring-accent cursor-pointer"
        {...rest}
      />
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

  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
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
        <div role="status" className="flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/10 p-3.5 text-sm text-accent-text font-medium shadow-sm animate-in fade-in">
          <CheckCircle2 className="size-4.5 shrink-0 text-accent" />
          <span>{note}</span>
        </div>
      ) : null}
    </>
  );
}
