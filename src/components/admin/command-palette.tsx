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
  ExternalLink,
  Landmark,
  LayoutDashboard,
  LogOut,
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
  { id: "showtimes", label: "Showtimes & Scheduling", category: "Navigation", href: "/admin/showtimes", icon: CalendarClock, permission: "showtimes.manage", keywords: "screenings schedule" },
  { id: "scan", label: "Scan Tickets (Door Scanner)", category: "Navigation", href: "/admin/tickets/scan", icon: ScanLine, permission: "tickets.validate", keywords: "qr camera check-in admit" },

  // Finance & Commerce
  { id: "bookings", label: "Bookings & Orders", category: "Navigation", href: "/admin/bookings", icon: Ticket, permission: "bookings.view", keywords: "reservations tickets sales" },
  { id: "payments", label: "Payments Review Queue", category: "Navigation", href: "/admin/payments", icon: Banknote, permission: "payments.view", keywords: "slips transfers wire approvals" },
  { id: "refunds", label: "Refund Requests", category: "Navigation", href: "/admin/refunds", icon: Undo2, permission: "refunds.decide", keywords: "returns cancellations" },
  { id: "bank", label: "Bank Accounts", category: "Navigation", href: "/admin/bank-accounts", icon: Landmark, permission: "payments.manage_bank_accounts", keywords: "deposit wire wire-transfer" },
  { id: "promos", label: "Promotions & Discounts", category: "Navigation", href: "/admin/promotions", icon: Percent, permission: "promotions.manage", keywords: "coupons promo codes vouchers" },

  // Management & Security
  { id: "customers", label: "Customer Accounts", category: "Navigation", href: "/admin/customers", icon: Users, permission: "customers.view", keywords: "users guests" },
  { id: "staff", label: "Staff & Permissions", category: "Navigation", href: "/admin/staff", icon: ShieldCheck, permission: "staff.manage", keywords: "roles access security 2fa" },
  { id: "audit", label: "Security Audit Logs", category: "Navigation", href: "/admin/audit-logs", icon: ScrollText, permission: "audit.view", keywords: "logs compliance history" },

  // Content & Config
  { id: "content", label: "Content CMS (Events, News, Inbox)", category: "Navigation", href: "/admin/content", icon: Newspaper, permission: "content.manage", keywords: "articles blog messages" },
  { id: "settings", label: "Portal & Website Settings", category: "Navigation", href: "/admin/settings", icon: Settings, permission: "settings.manage", keywords: "branding contact config" },

  // Quick actions
  { id: "act-scan", label: "Quick Action: Scan Ticket QR", category: "Quick Action", href: "/admin/tickets/scan", icon: ScanLine, permission: "tickets.validate" },
  { id: "act-showtime", label: "Quick Action: Create Showtime", category: "Quick Action", href: "/admin/showtimes", icon: CalendarClock, permission: "showtimes.manage" },
  { id: "act-payments", label: "Quick Action: Review Pending Slips", category: "Quick Action", href: "/admin/payments", icon: Banknote, permission: "payments.view" },
  { id: "act-site", label: "Open Consumer Website", category: "System", href: "/", icon: ExternalLink, external: true },
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

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
        else onClose(); // parent handles toggle
      }
      if (open) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
        } else if (e.key === "Enter" && filtered[selectedIndex]) {
          e.preventDefault();
          const item = filtered[selectedIndex];
          execute(item);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, filtered, selectedIndex]);

  const execute = (item: CommandItem) => {
    onClose();
    if (item.external) {
      window.open(item.href, "_blank");
    } else {
      router.push(item.href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:pt-24 animate-in fade-in duration-150"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line/80 bg-elevated shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5">
          <Search className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, sections, actions..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded p-1 text-muted hover:text-foreground"
              aria-label="Clear query"
            >
              <X className="size-4" />
            </button>
          )}
          <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto p-2 scrollbar-none">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              No matching pages or commands found for &ldquo;{query}&rdquo;
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
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                        isSelected
                          ? "bg-accent/15 text-foreground font-medium"
                          : "text-muted hover:bg-surface/80 hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg transition-colors",
                            isSelected ? "bg-accent text-on-accent" : "bg-surface text-muted",
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className={cn("text-sm", isSelected && "text-foreground font-semibold")}>{item.label}</p>
                          <p className="text-[11px] text-muted">{item.category}</p>
                        </div>
                      </div>
                      {item.external ? (
                        <ExternalLink className="size-3.5 text-muted" />
                      ) : (
                        isSelected && (
                          <span className="text-[11px] font-medium text-accent">Jump ↵</span>
                        )
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-line/60 bg-surface/50 px-4 py-2.5 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-line bg-background px-1 py-0.5 font-mono">↑</kbd>{" "}
              <kbd className="rounded border border-line bg-background px-1 py-0.5 font-mono">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-line bg-background px-1.5 py-0.5 font-mono">↵</kbd> select
            </span>
          </div>
          <span>AR Entertainment Ops Command Center</span>
        </div>
      </div>
    </div>
  );
}

