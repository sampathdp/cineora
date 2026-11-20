"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  Clapperboard,
  Command,
  CornerDownLeft,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  Newspaper,
  Percent,
  ScanLine,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  category: "Navigation" | "Quick Action" | "System";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string | null;
  external?: boolean;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  // Overview
  { id: "dash", label: "Dashboard Overview", category: "Navigation", href: "/admin", icon: LayoutDashboard },
  { id: "reports", label: "Financial & Occupancy Reports", category: "Navigation", href: "/admin/reports", icon: BarChart3, permission: "reports.view" },

  // Operations
  { id: "movies", label: "Movies & Catalog", category: "Navigation", href: "/admin/movies", icon: Clapperboard, permission: "movies.view", keywords: "films titles" },
  { id: "cinemas", label: "Cinemas & Screening Rooms", category: "Navigation", href: "/admin/cinemas", icon: Building2, permission: "cinemas.view", keywords: "theatres halls screens" },
  { id: "showtimes", label: "Showtimes & Scheduling", category: "Navigation", href: "/admin/showtimes", icon: CalendarClock, permission: "showtimes.manage", keywords: "screenings schedule grid" },
  { id: "scan", label: "Scan Tickets (Door Scanner)", category: "Navigation", href: "/admin/tickets/scan", icon: ScanLine, permission: "tickets.validate", keywords: "qr camera check-in admit" },

  // Finance & Commerce
  { id: "bookings", label: "Bookings & Orders", category: "Navigation", href: "/admin/bookings", icon: Ticket, permission: "bookings.view", keywords: "reservations tickets sales" },
  { id: "payments", label: "Payments Review Queue", category: "Navigation", href: "/admin/payments", icon: Banknote, permission: "payments.view", keywords: "slips transfers wire approvals" },
  { id: "refunds", label: "Refund Requests", category: "Navigation", href: "/admin/refunds", icon: Undo2, permission: "refunds.decide", keywords: "returns cancellations" },
  { id: "bank", label: "Bank Accounts", category: "Navigation", href: "/admin/bank-accounts", icon: Landmark, permission: "payments.manage_bank_accounts", keywords: "deposit wire wire-transfer" },
  { id: "promos", label: "Promotions & Discounts", category: "Navigation", href: "/admin/promotions", icon: Percent, permission: "promotions.manage", keywords: "coupons promo codes vouchers" },

  // Management & Security
  { id: "customers", label: "Customer Accounts", category: "Navigation", href: "/admin/customers", icon: Users, permission: "customers.view", keywords: "users guests directory" },
  { id: "staff", label: "Staff & Permissions", category: "Navigation", href: "/admin/staff", icon: ShieldCheck, permission: "staff.manage", keywords: "roles access security 2fa rbac" },
  { id: "audit", label: "Security Audit Logs", category: "Navigation", href: "/admin/audit-logs", icon: ScrollText, permission: "audit.view", keywords: "logs compliance history" },

  // Content & Config
  { id: "content", label: "Content CMS (Events, News, Inbox)", category: "Navigation", href: "/admin/content", icon: Newspaper, permission: "content.manage", keywords: "articles blog messages" },
  { id: "settings", label: "Portal & Website Settings", category: "Navigation", href: "/admin/settings", icon: Settings, permission: "settings.manage", keywords: "branding contact config" },

  // Quick actions
  { id: "act-scan", label: "Quick Action: Scan Ticket QR", category: "Quick Action", href: "/admin/tickets/scan", icon: ScanLine, permission: "tickets.validate" },
  { id: "act-showtime", label: "Quick Action: Schedule New Showtime", category: "Quick Action", href: "/admin/showtimes", icon: CalendarClock, permission: "showtimes.manage" },
  { id: "act-payments", label: "Quick Action: Review Pending Slips", category: "Quick Action", href: "/admin/payments", icon: Banknote, permission: "payments.view" },
  { id: "act-site", label: "Open Consumer Live Website", category: "System", href: "/", icon: ExternalLink, external: true },
];

export function AdminCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const availableCommands = useMemo(() => {
    return COMMANDS.filter((cmd) => cmd.permission === undefined || cmd.permission === null || can(cmd.permission));
  }, [can]);

  const filtered = useMemo(() => {
    if (!query.trim()) return availableCommands;
    const q = query.toLowerCase().trim();
    return availableCommands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(q);
      const matchCategory = cmd.category.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords?.toLowerCase().includes(q) ?? false;
      return matchLabel || matchCategory || matchKeywords;
    });
  }, [availableCommands, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = (item: CommandItem) => {
    onClose();
    if (item.external) {
      window.open(item.href, "_blank", "noreferrer");
    } else {
      router.push(item.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      execute(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-xl flex-col rounded-2xl border border-line/80 bg-elevated text-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Glowing top line */}
        <div className="h-1 w-full bg-gradient-to-r from-accent/20 via-accent to-accent/20" />

        {/* Input Bar */}
        <div className="flex items-center gap-3 border-b border-line/60 px-4 py-3.5 bg-surface/50">
          <Search className="size-5 shrink-0 text-accent" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or jump to page…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="rounded-lg p-1 text-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 [scrollbar-width:thin]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              <Command className="mx-auto mb-2 size-8 text-muted/40" />
              <p>No matching commands found.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => execute(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 cursor-pointer",
                        isSelected
                          ? "bg-accent/15 text-accent font-semibold shadow-sm"
                          : "text-muted hover:bg-surface/80 hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg transition",
                            isSelected
                              ? "bg-accent text-on-accent shadow-sm"
                              : "bg-surface text-muted group-hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            isSelected
                              ? "bg-accent/20 text-accent font-bold"
                              : "bg-surface text-muted/80",
                          )}
                        >
                          {item.category}
                        </span>
                        {isSelected && (
                          <CornerDownLeft className="size-3.5 text-accent animate-pulse" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-line/60 bg-surface/50 px-4 py-2.5 text-[11px] text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">
            AR Entertainment HQ
          </span>
        </div>
      </div>
    </div>
  );
}
