"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Command,
  ExternalLink,
  Film,
  Globe,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Percent,
  ScanLine,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Ticket,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";
import { AdminCommandPalette } from "./command-palette";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string | null;
  badge?: string;
  badgeTone?: "good" | "warn" | "bad" | "info";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: null },
      { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    title: "Cinema Operations",
    items: [
      { href: "/admin/movies", label: "Movies & Catalog", icon: Clapperboard, permission: "movies.view" },
      { href: "/admin/cinemas", label: "Cinemas & Rooms", icon: Building2, permission: "cinemas.view" },
      { href: "/admin/showtimes", label: "Showtimes & Grid", icon: CalendarClock, permission: "showtimes.manage" },
      { href: "/admin/tickets/scan", label: "Ticket Scanner", icon: ScanLine, permission: "tickets.validate", badge: "Scanner" },
    ],
  },
  {
    title: "Commerce & Sales",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: Ticket, permission: "bookings.view" },
      { href: "/admin/payments", label: "Payments Queue", icon: Banknote, permission: "payments.view" },
      { href: "/admin/refunds", label: "Refund Requests", icon: Undo2, permission: "refunds.decide" },
      { href: "/admin/bank-accounts", label: "Bank Accounts", icon: Landmark, permission: "payments.manage_bank_accounts" },
      { href: "/admin/promotions", label: "Promotions & Codes", icon: Percent, permission: "promotions.manage" },
    ],
  },
  {
    title: "Users & Security",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
      { href: "/admin/staff", label: "Staff & Access", icon: ShieldCheck, permission: "staff.manage" },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit.view" },
    ],
  },
  {
    title: "System & CMS",
    items: [
      { href: "/admin/content", label: "Content & CMS", icon: Newspaper, permission: "content.manage" },
      { href: "/admin/settings", label: "Website Settings", icon: Settings, permission: "settings.manage" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { status, user, can, logout } = useAuth();
  const { resolved, setPreference } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const toggleTheme = () => setPreference(resolved === "dark" ? "light" : "dark");

  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const needsLogin = status === "anonymous" || (status === "authenticated" && !user?.is_staff);
  const needsMfa = !!user && ((user.mfa.enabled && !user.mfa.verified) || (user.mfa.required && !user.mfa.enabled));

  useEffect(() => {
    if (needsLogin || needsMfa) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [needsLogin, needsMfa, router, pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Global Ctrl+K trigger shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter sections by role permissions
  const visibleSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.permission === null || can(item.permission)),
    })).filter((section) => section.items.length > 0);
  }, [can]);

  // Find active breadcrumb label
  const currentTitle = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.href === "/admin" && pathname === "/admin") return { title: item.label, section: section.title };
        if (item.href !== "/admin" && pathname.startsWith(item.href)) return { title: item.label, section: section.title };
      }
    }
    return { title: "Operations", section: "Admin" };
  }, [pathname]);

  if (status === "loading" || needsLogin || needsMfa || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="text-xs uppercase tracking-widest text-muted">Authenticating staff session…</p>
        </div>
      </div>
    );
  }

  // User initials for avatar
  const initials = (user.name || "Admin")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Command Palette Dialog */}
      <AdminCommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line/80 bg-surface text-foreground shadow-2xl transition-transform duration-300 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line/60 px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-on-accent shadow-md shadow-accent/20">
              <Film className="size-5" />
            </div>
            <div>
              <span className="display text-lg font-bold tracking-wider">CINEORA</span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-accent">Operations</span>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-foreground"
            aria-label="Close navigation menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Mobile Search trigger */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setCommandOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl border border-line/70 bg-elevated/70 px-3.5 py-2.5 text-xs text-muted shadow-sm transition hover:border-line hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" />
              <span>Jump to…</span>
            </span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono">Ctrl+K</kbd>
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
          {visibleSections.map((sec) => (
            <div key={sec.title} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{sec.title}</p>
              <ul className="space-y-0.5">
                {sec.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          active
                            ? "bg-accent/15 text-accent font-semibold"
                            : "text-muted hover:bg-elevated hover:text-foreground",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={cn("size-4 transition", active ? "text-accent" : "text-muted group-hover:text-foreground")} />
                          <span>{label}</span>
                        </span>
                        {badge && (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* User Card */}
        <div className="border-t border-line/60 bg-surface/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/15 font-semibold text-accent border border-accent/20">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{user.roles.join(", ") || "Staff"}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.replace("/admin/login");
              }}
              title="Sign out"
              className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-rose-500"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line/70 bg-surface/95 backdrop-blur-md transition-all duration-300 lg:flex",
          collapsed ? "w-20" : "w-64 xl:w-72",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-line/60 px-4">
          <Link href="/admin" className={cn("flex items-center gap-2.5", collapsed && "justify-center w-full")}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-on-accent shadow-md shadow-accent/20">
              <Film className="size-5" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <span className="display text-lg font-bold tracking-wider leading-none">CINEORA</span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-accent leading-tight">
                  Operations HQ
                </span>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-foreground transition"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <div className="flex justify-center border-b border-line/60 py-2">
            <button
              onClick={() => setCollapsed(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-foreground transition"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {/* Search / Command palette trigger */}
        {!collapsed && (
          <div className="px-3 pt-3 pb-1">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="group flex w-full items-center justify-between rounded-xl border border-line/70 bg-elevated/70 px-3 py-2 text-xs text-muted shadow-sm transition hover:border-line hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Search className="size-3.5 text-muted group-hover:text-foreground transition" />
                <span>Search portal…</span>
              </span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted group-hover:text-foreground">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-none space-y-5">
          {visibleSections.map((sec) => (
            <div key={sec.title}>
              {!collapsed ? (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                  {sec.title}
                </p>
              ) : (
                <div className="mx-auto my-1.5 h-px w-8 bg-line/60" />
              )}
              <ul className="space-y-0.5">
                {sec.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={collapsed ? label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-xl transition-all duration-150",
                          collapsed ? "size-10 justify-center mx-auto" : "justify-between px-3 py-2 text-sm font-medium",
                          active
                            ? "bg-accent/15 text-accent font-semibold"
                            : "text-muted hover:bg-elevated hover:text-foreground",
                        )}
                      >
                        {/* Active indicator bar */}
                        {active && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent" />
                        )}
                        <span className="flex items-center gap-2.5">
                          <Icon className={cn("size-4 shrink-0 transition", active ? "text-accent" : "text-muted group-hover:text-foreground")} />
                          {!collapsed && <span className="truncate">{label}</span>}
                        </span>
                        {!collapsed && badge && (
                          <span className="rounded-full bg-accent/15 border border-accent/25 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Profile and Utilities */}
        <div className="border-t border-line/60 bg-surface/50 p-3">
          {!collapsed ? (
            <div className="space-y-2.5">
              {/* Quick links & theme switcher bar */}
              <div className="flex items-center justify-between px-1 text-xs text-muted">
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-muted hover:text-foreground transition"
                  title="Open public website in a new tab"
                >
                  <Globe className="size-3.5" />
                  <span>Public Site</span>
                  <ExternalLink className="size-3 opacity-60" />
                </a>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1 rounded-md p-1 hover:bg-elevated hover:text-foreground transition"
                  title="Toggle light / dark theme"
                >
                  {resolved === "dark" ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-slate-700" />}
                </button>
              </div>

              {/* User badge */}
              <div className="flex items-center justify-between rounded-xl border border-line/60 bg-elevated/80 p-2.5 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent border border-accent/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-[10px] text-muted uppercase tracking-wider">
                      {user.roles[0]?.replaceAll("_", " ") || "Staff"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    router.replace("/admin/login");
                  }}
                  title="Sign out"
                  className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-rose-500 transition"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-foreground transition"
                title="Toggle theme"
              >
                {resolved === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
              </button>
              <button
                onClick={async () => {
                  await logout();
                  router.replace("/admin/login");
                }}
                title="Sign out"
                className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-rose-500 transition"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-line/60 bg-background/80 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          {/* Left: Mobile hamburger & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </button>

            {/* Breadcrumb indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-muted">{currentTitle.section}</span>
              <ChevronRight className="size-3 text-muted/40" />
              <span className="font-semibold text-foreground">{currentTitle.title}</span>
            </div>
          </div>

          {/* Right: Search shortcut, System live status, theme toggle, and profile */}
          <div className="flex items-center gap-3">
            {/* Quick search button */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface/70 px-3 py-1.5 text-xs text-muted shadow-sm transition hover:border-line hover:text-foreground"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search portal…</span>
              <kbd className="hidden sm:inline rounded border border-line bg-background px-1.5 py-0.5 text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Live Operations badge */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>HQ Online</span>
            </div>

            {/* Public site link */}
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-line/70 px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-line hover:text-foreground transition"
              title="Open public website in a new tab"
            >
              <span>Live Site</span>
              <ExternalLink className="size-3" />
            </a>

            {/* Theme switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl border border-line/70 p-2 text-muted hover:border-line hover:text-foreground transition"
              title="Toggle light / dark mode"
              aria-label="Toggle theme"
            >
              {resolved === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
            </button>

            {/* Staff Pill */}
            <div className="flex items-center gap-2 rounded-full border border-line/60 bg-surface/80 py-1 pl-1 pr-3">
              <div className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-on-accent">
                {initials}
              </div>
              <span className="max-w-[100px] truncate text-xs font-semibold text-foreground hidden sm:inline">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </div>
      </div>
    </div>
  );
}
