"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogBehavior, useScrollLock } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * In-app replacements for window.confirm / alert / prompt. Call them from anywhere on the client:
 *
 *   if (await confirmDialog({ title: "Delete hall?", danger: true })) { ... }
 *   await alertDialog({ title: "Done", message: "3 showtimes published." });
 *   const reason = await promptDialog({ title: "Reason", minLength: 5 });   // null when dismissed
 *
 * <DialogHost /> must be mounted once (root layout). Requests queue, so only one dialog shows at a time.
 */

type Tone = "default" | "danger" | "success";

interface Base {
  title: string;
  message?: React.ReactNode;
  tone?: Tone;
}
export interface ConfirmOptions extends Base {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shorthand for tone: "danger". */
  danger?: boolean;
}
export interface AlertOptions extends Base {
  okLabel?: string;
}
export interface PromptOptions extends Base {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  minLength?: number;
  multiline?: boolean;
  danger?: boolean;
}

type Request =
  | { id: number; kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: "alert"; opts: AlertOptions; resolve: (v: void) => void }
  | { id: number; kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

let queue: Request[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const current = () => queue[0] ?? null;

function push<T>(make: (id: number, resolve: (v: T) => void) => Request): Promise<T> {
  return new Promise<T>((resolve) => {
    queue = [...queue, make(++seq, resolve)];
    emit();
  });
}
function settle(id: number) {
  queue = queue.filter((r) => r.id !== id);
  emit();
}

export const confirmDialog = (opts: ConfirmOptions) =>
  push<boolean>((id, resolve) => ({ id, kind: "confirm", opts, resolve }));
export const alertDialog = (opts: AlertOptions) => push<void>((id, resolve) => ({ id, kind: "alert", opts, resolve }));
export const promptDialog = (opts: PromptOptions) =>
  push<string | null>((id, resolve) => ({ id, kind: "prompt", opts, resolve }));

const icons: Record<Tone, { icon: LucideIcon; cls: string }> = {
  default: { icon: Info, cls: "bg-accent/15 text-accent border-accent/25" },
  danger: { icon: AlertTriangle, cls: "bg-rose-500/15 text-rose-500 border-rose-500/25" },
  success: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/25" },
};

export function DialogHost() {
  const req = useSyncExternalStore(subscribe, current, () => null);
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {req ? (
        <motion.div
          key={req.id}
          className="fixed inset-0 z-[300] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          <Panel req={req} reduce={!!reduce} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Panel({ req, reduce }: { req: Request; reduce: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const [value, setValue] = useState(req.kind === "prompt" ? (req.opts.defaultValue ?? "") : "");
  const [touched, setTouched] = useState(false);

  const danger = (req.kind !== "alert" && req.opts.danger) || req.opts.tone === "danger";
  const tone: Tone = danger ? "danger" : (req.opts.tone ?? "default");
  const { icon: Icon, cls } = icons[tone];

  const min = req.kind === "prompt" ? (req.opts.minLength ?? 1) : 0;
  const invalid = req.kind === "prompt" && value.trim().length < min;

  function dismiss() {
    settle(req.id);
    if (req.kind === "confirm") req.resolve(false);
    else if (req.kind === "prompt") req.resolve(null);
    else req.resolve();
  }
  function accept() {
    if (req.kind === "prompt") {
      setTouched(true);
      if (invalid) return;
      settle(req.id);
      req.resolve(value.trim());
      return;
    }
    settle(req.id);
    if (req.kind === "confirm") req.resolve(true);
    else req.resolve();
  }

  useScrollLock(true);
  useDialogBehavior(true, dismiss, panelRef);

  const confirmLabel =
    req.kind === "alert" ? (req.opts.okLabel ?? "OK") : (req.opts.confirmLabel ?? (danger ? "Confirm" : "Continue"));
  const cancelLabel = req.kind === "alert" ? null : (req.opts.cancelLabel ?? "Cancel");

  return (
    <>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden />
      <motion.div
        ref={panelRef}
        role={req.kind === "alert" || danger ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={req.opts.message ? descId : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-2xl border border-line/70 bg-elevated p-6 shadow-2xl outline-none"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            accept();
          }}
        >
          <div className="flex items-start gap-4">
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl border", cls)}>
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="text-base font-bold text-foreground">
                {req.opts.title}
              </h2>
              {req.opts.message ? (
                <div id={descId} className="mt-1.5 text-sm leading-relaxed text-muted break-words">
                  {req.opts.message}
                </div>
              ) : null}
            </div>
          </div>

          {req.kind === "prompt" ? (
            <div className="mt-5">
              {req.opts.label ? (
                <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                  {req.opts.label}
                </label>
              ) : null}
              {req.opts.multiline ? (
                <textarea
                  id={inputId}
                  data-autofocus
                  rows={3}
                  value={value}
                  placeholder={req.opts.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={touched && invalid}
                  className="w-full resize-y rounded-xl border border-line/70 bg-background/90 px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              ) : (
                <input
                  id={inputId}
                  data-autofocus
                  value={value}
                  placeholder={req.opts.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={touched && invalid}
                  className="h-11 w-full rounded-xl border border-line/70 bg-background/90 px-3 text-sm outline-none focus:border-accent"
                />
              )}
              {touched && invalid ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-rose-500">
                  {min > 1 ? `Enter at least ${min} characters.` : "This field is required."}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {cancelLabel ? (
              <Button type="button" variant="secondary" onClick={dismiss} data-autofocus={danger ? true : undefined}>
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              type="submit"
              data-autofocus={!danger && req.kind !== "prompt" ? true : undefined}
              className={cn(danger && "bg-rose-600 text-white shadow-none hover:bg-rose-700")}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </motion.div>
    </>
  );
}
