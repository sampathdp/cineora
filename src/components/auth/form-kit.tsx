"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const inputClass = (bad: boolean) =>
  cn(
    "h-12 w-full rounded-control border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-accent",
    bad ? "border-red-500" : "border-line",
  );

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, id, className, ...rest }, ref) {
  const fieldId = id ?? `f-${rest.name}`;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
        className={inputClass(!!error)}
        {...rest}
      />
      {hint && !error ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId}-err`} role="alert" className="mt-1.5 text-sm text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export function FormMessage({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control border p-3 text-sm",
        tone === "error" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-accent/50 bg-accent/10",
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Centered card used by every account page so they share one look. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center pb-16 pt-28">
      <div className="w-full max-w-md rounded-card border border-line bg-elevated p-6 shadow-card sm:p-8">
        <h1 className="display text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 border-t border-line pt-4 text-sm text-muted">{footer}</div> : null}
      </div>
    </section>
  );
}

/**
 * Copies server-side validation errors onto form fields. Returns a message for anything that is
 * not a field error (network failure, rate limit, ...).
 */
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  let matched = false;
  for (const field of fields) {
    const msg = error.fieldError(field as string);
    if (msg) {
      setError(field, { type: "server", message: msg });
      matched = true;
    }
  }
  if (matched) return null;
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  return error.message;
}
