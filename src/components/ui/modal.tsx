"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lockCount = 0;
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Focus trap, Escape to close, focus restore. */
export function useDialogBehavior(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Visually hide the title but keep it for screen readers. */
  hideTitle?: boolean;
  className?: string;
  align?: "center" | "top";
}

/** Accessible dialog: focus trap, Escape to close, scroll lock, focus return. */
export function Modal({ open, onClose, title, children, hideTitle, className, align = "center" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useScrollLock(open);

  useDialogBehavior(open, onClose, panelRef);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn("fixed inset-0 z-[100] flex justify-center px-4", align === "center" ? "items-center py-6" : "items-start pt-[8vh]")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "relative max-h-full w-full overflow-auto rounded-card border border-line bg-elevated text-foreground shadow-2xl outline-none",
              className ?? "max-w-3xl",
            )}
          >
            <div className={cn("flex items-center justify-between gap-4 px-5 pt-4", hideTitle && "sr-only")}>
              <h2 id={titleId} className="display text-2xl">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-black/50 text-white transition hover:bg-accent hover:text-on-accent"
            >
              <X className="size-5" aria-hidden />
            </button>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
