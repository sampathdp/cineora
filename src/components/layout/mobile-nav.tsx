"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, Ticket, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { BrandImage } from "./logo";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { useDialogBehavior, useScrollLock } from "@/components/ui/modal";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/providers/auth-provider";

export function MobileNav({
  open,
  onClose,
  onSearch,
  isActive,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  isActive: (href: string) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const { user } = useAuth();
  const first = useRef(true);
  useScrollLock(open);
  useDialogBehavior(open, onClose, ref);

  // Close after navigating (skip the initial mount).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
            className="absolute right-0 top-0 flex h-full w-[min(22rem,100%)] flex-col overflow-y-auto border-l border-line bg-background p-5 text-foreground shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between">
              <BrandImage className="h-10" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-full hover:bg-surface"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>

            <nav aria-label="Mobile" className="mt-6">
              <ul className="flex flex-col">
                {siteConfig.nav.map((item) => (
                  <li key={item.href} className="border-b border-line">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "display flex min-h-14 items-center text-3xl transition-colors hover:text-accent-text",
                        isActive(item.href) && "text-accent-text",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={onSearch} className={buttonClass("secondary", "lg", "w-full")}>
                <Search className="size-5" aria-hidden /> Search
              </button>
              <Link href={user ? "/account" : "/login"} onClick={onClose} className={buttonClass("secondary", "lg", "w-full")}>
                {user ? "Your account" : "Sign in"}
              </Link>
              <Link href="/movies" onClick={onClose} className={buttonClass("primary", "lg", "w-full")}>
                <Ticket className="size-5" aria-hidden /> Get Tickets
              </Link>
            </div>

            <div className="mt-auto flex items-center justify-between pt-8">
              <span className="text-sm text-muted">Theme</span>
              <ThemeToggle />
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
