"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, Ticket, User } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SearchOverlay } from "./search-overlay";
import { MobileNav } from "./mobile-nav";
import { useAuth } from "@/providers/auth-provider";

export function Header() {
  const pathname = usePathname();
  const { status, user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Home keeps a transparent header over the hero until the user scrolls.
  const overHero = pathname === "/" && !scrolled;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // The admin portal has its own dedicated dashboard chrome and topbar.
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
          overHero ? "on-dark border-b border-transparent bg-gradient-to-b from-black/60 to-transparent" : "border-b border-line bg-background/85 text-foreground backdrop-blur-lg",
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <Logo />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-sm font-semibold tracking-wide transition-colors hover:text-accent-text",
                      isActive(item.href) && "text-accent-text",
                      overHero && "hover:text-accent",
                      overHero && isActive(item.href) && "text-accent",
                    )}
                  >
                    {item.label}
                    {isActive(item.href) ? (
                      <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded bg-accent" aria-hidden />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-haspopup="dialog"
              className="grid size-10 place-items-center rounded-full transition hover:bg-current/10"
            >
              <Search className="size-5" aria-hidden />
            </button>
            <ThemeToggle className="max-lg:hidden" />
            <Link
              href={user ? "/account" : "/login"}
              aria-label={user ? `Your account (${user.name})` : "Sign in"}
              className="grid size-10 place-items-center rounded-full transition hover:bg-current/10 max-sm:hidden"
              title={user ? "Your account" : "Sign in"}
            >
              {user ? (
                <span className="grid size-7 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent" aria-hidden>
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="size-5" aria-hidden />
              )}
              {status === "loading" ? <span className="sr-only">Checking sign-in status</span> : null}
            </Link>
            <Link href="/movies" className={buttonClass("primary", "sm", "max-md:hidden")}>
              <Ticket className="size-4" aria-hidden /> Get Tickets
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              className="grid size-10 place-items-center rounded-full transition hover:bg-current/10 lg:hidden"
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSearch={() => {
          setMenuOpen(false);
          setSearchOpen(true);
        }}
        isActive={isActive}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
