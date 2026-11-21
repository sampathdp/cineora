"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Clapperboard,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  ShieldCheck,
  Smartphone,
  Ticket,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/dialogs";
import { useAuth } from "@/providers/auth-provider";
import { authApi, type AccountProfile, type AuthUser, type SessionInfo } from "@/lib/api/auth";
import { bookingsApi, STATUS_LABEL, type ApiBooking } from "@/lib/api/bookings";
import { formatPrice } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Field, FormMessage, applyApiError, inputClass } from "./form-kit";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Security", icon: KeyRound },
  { key: "devices", label: "Devices", icon: Monitor },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const AWAITING: ApiBooking["status"][] = ["PENDING_PAYMENT", "PAYMENT_REJECTED", "PAYMENT_REVIEW"];

function Card({ title, hint, children, className }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-card border border-line bg-elevated p-6 sm:p-7", className)}>
      {title ? (
        <header className="mb-5">
          <h2 className="display text-2xl">{title}</h2>
          {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function AccountView() {
  const { status, user, logout, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "overview";

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  const setTab = (key: TabKey) => router.replace(key === "overview" ? pathname : `${pathname}?tab=${key}`, { scroll: false });

  if (status !== "authenticated" || !user) {
    return (
      <section className="container-page pb-16 pt-28" aria-busy="true">
        <div className="h-40 animate-pulse rounded-card bg-surface" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="container-page pb-20 pt-28">
      <Hero
        user={user}
        onSignOut={async () => {
          await logout();
          router.replace("/");
        }}
      />

      {!user.email_verified ? <VerifyBanner /> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Account sections" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:none]">
            {TABS.map((t) => (
              <li key={t.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-control px-4 py-2.5 text-sm font-semibold transition",
                    tab === t.key ? "bg-accent text-on-accent" : "text-muted hover:bg-surface hover:text-foreground",
                  )}
                >
                  <t.icon className="size-4" aria-hidden />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {tab === "overview" ? <Overview user={user} onGo={setTab} /> : null}
          {tab === "profile" ? <ProfilePanel onSaved={refresh} /> : null}
          {tab === "security" ? (
            <>
              <PasswordPanel />
              <TwoFactorCard user={user} />
            </>
          ) : null}
          {tab === "devices" ? <SessionsPanel /> : null}
        </div>
      </div>
    </section>
  );
}

function Hero({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-elevated">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--accent)_45%,transparent),transparent_60%)] opacity-80"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-5 p-6 pt-10 sm:p-8 sm:pt-12">
        <div className="flex min-w-0 items-center gap-5">
          <div className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-elevated bg-accent text-2xl font-extrabold text-on-accent shadow-lg sm:size-24 sm:text-3xl">
            {initials(user.name) || <User className="size-8" aria-hidden />}
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Your account</p>
            <h1 className="display truncate text-3xl sm:text-5xl">{user.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{user.email}</span>
              </span>
              {user.email_verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="size-3.5" aria-hidden /> Verified
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">Not verified</span>
              )}
              {user.is_staff ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-text">Staff</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.is_staff ? (
            <Link href="/admin/" className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-elevated px-5 text-sm font-semibold hover:border-accent hover:text-accent-text">
              <ShieldCheck className="size-4" aria-hidden /> Staff portal
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onSignOut}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-control border border-accent/50 bg-accent/10 p-4" role="status">
      <p className="flex items-center gap-2 text-sm">
        <Mail className="size-4 shrink-0 text-accent" aria-hidden />
        Please verify your email address before booking. Check your inbox for the link.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await authApi.resendVerification();
            setMsg("Sent. Check your inbox.");
          } catch {
            setMsg("Could not send right now. Try again in a minute.");
          }
        }}
      >
        Resend link
      </Button>
      {msg ? <p className="w-full text-sm text-muted">{msg}</p> : null}
    </div>
  );
}

// --- Overview -----------------------------------------------------------------

function Overview({ user, onGo }: { user: AuthUser; onGo: (t: TabKey) => void }) {
  const [bookings, setBookings] = useState<ApiBooking[] | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    bookingsApi
      .list()
      .then((r) => {
        if (!live) return;
        // The server clock decides what is "upcoming"; fall back to this device's clock.
        setNow(Date.parse(r.serverNow) || Date.now());
        setBookings(r.bookings);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!bookings) return null;
    const upcoming = bookings
      .filter((b) => b.status === "CONFIRMED" && b.showtime && new Date(b.showtime.starts_at).getTime() > now)
      .sort((a, b) => a.showtime!.starts_at.localeCompare(b.showtime!.starts_at));
    const awaiting = bookings.filter((b) => AWAITING.includes(b.status));
    return { upcoming, awaiting, total: bookings.length };
  }, [bookings, now]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarClock} label="Upcoming screenings" value={stats?.upcoming.length} href="/account/tickets/" />
        <Stat icon={Wallet} label="Awaiting payment" value={stats?.awaiting.length} href="/account/bookings/" tone={stats && stats.awaiting.length > 0 ? "warn" : undefined} />
        <Stat icon={Ticket} label="Total bookings" value={stats?.total} href="/account/bookings/" />
      </div>

      {error ? <FormMessage>Could not load your bookings.</FormMessage> : null}

      {stats?.awaiting.length ? (
        <Card title="Finish your payment" hint="Seats are only held for a limited time.">
          <ul className="divide-y divide-line">
            {stats.awaiting.slice(0, 3).map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Next screening">
        {!bookings && !error ? <div className="h-28 animate-pulse rounded-control bg-surface" /> : null}
        {stats && stats.upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-control border border-dashed border-line p-8 text-center">
            <Clapperboard className="size-8 text-muted" aria-hidden />
            <p className="text-muted">No upcoming screenings yet.</p>
            <Link href="/movies/" className="font-semibold text-accent-text hover:underline">
              Browse what&apos;s showing
            </Link>
          </div>
        ) : null}
        {stats?.upcoming[0] ? <NextScreening b={stats.upcoming[0]} now={now} /> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink icon={Ticket} title="My tickets" text="QR tickets for entry" href="/account/tickets/" />
        <QuickLink icon={CalendarClock} title="My bookings" text="History, payments and refunds" href="/account/bookings/" />
        <QuickLink icon={User} title="Edit profile" text="Name, phone and language" onClick={() => onGo("profile")} />
        <QuickLink
          icon={KeyRound}
          title="Security"
          text={user.mfa.enabled ? "Password · two-factor on" : "Password and sign-in"}
          onClick={() => onGo("security")}
        />
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, href, tone }: { icon: LucideIcon; label: string; value?: number; href: string; tone?: "warn" }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-card border bg-elevated p-5 transition hover:border-accent",
        tone === "warn" ? "border-amber-500/50" : "border-line",
      )}
    >
      <div className={cn("grid size-11 place-items-center rounded-2xl", tone === "warn" ? "bg-amber-500/15 text-amber-500" : "bg-accent/15 text-accent")}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none">{value ?? <span className="inline-block h-6 w-8 animate-pulse rounded bg-surface align-middle" />}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      </div>
    </Link>
  );
}

function showDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function NextScreening({ b, now }: { b: ApiBooking; now: number }) {
  const st = b.showtime!;
  const days = Math.ceil((new Date(st.starts_at).getTime() - now) / 86_400_000);
  return (
    <Link href={`/account/bookings/view/?id=${encodeURIComponent(b.id)}`} className="group flex flex-wrap items-center justify-between gap-4 rounded-control border border-line bg-surface/40 p-5 transition hover:border-accent">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-text">{days <= 1 ? "Coming up soon" : `In ${days} days`}</p>
        <p className="display mt-1 truncate text-2xl">{st.movie.title}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden /> {showDate(st.starts_at, st.cinema.timezone)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden /> {st.cinema.name} · {st.room.name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Ticket className="size-4" aria-hidden /> {b.seats.map((s) => s.label).join(", ")}
          </span>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text">
        View booking <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function BookingRow({ b }: { b: ApiBooking }) {
  return (
    <li>
      <Link href={`/account/bookings/view/?id=${encodeURIComponent(b.id)}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent-text">
        <div className="min-w-0">
          <p className="truncate font-semibold">{b.showtime?.movie.title ?? b.reference}</p>
          <p className="text-xs text-muted">
            {b.reference} · {STATUS_LABEL[b.status]}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold">{formatPrice(b.total)}</span>
      </Link>
    </li>
  );
}

function QuickLink({ icon: Icon, title, text, href, onClick }: { icon: LucideIcon; title: string; text: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="grid size-10 place-items-center rounded-xl bg-surface text-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-sm text-muted">{text}</p>
      </div>
      <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
    </>
  );
  const cls = "group flex w-full cursor-pointer items-center gap-4 rounded-card border border-line bg-elevated p-4 transition hover:border-accent";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

// --- Profile ------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().regex(/^([0-9+\-\s()]{6,32})?$/, "Enter a valid phone number."),
  locale: z.enum(["en", "ko"]),
  marketing_opt_in: z.boolean(),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfilePanel({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });
  const locale = useWatch({ control, name: "locale" });
  const marketing = useWatch({ control, name: "marketing_opt_in" });

  useEffect(() => {
    let live = true;
    authApi
      .profile()
      .then((p: AccountProfile) => {
        if (!live) return;
        setEmail(p.user.email);
        reset({ name: p.user.name, phone: p.phone ?? "", locale: p.locale, marketing_opt_in: p.marketing_opt_in });
        setLoaded(true);
      })
      .catch(() => live && setFormError("Could not load your profile."));
    return () => {
      live = false;
    };
  }, [reset]);

  return (
    <Card title="Profile" hint="How we address you and reach you about your bookings.">
      {!loaded && !formError ? <div className="h-64 animate-pulse rounded-control bg-surface" /> : null}
      <form
        noValidate
        aria-label="Profile"
        className={cn("flex flex-col gap-6", !loaded && "hidden")}
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          setSaved(false);
          try {
            await authApi.updateProfile({ ...v, phone: v.phone || null });
            await onSaved();
            reset(v);
            setSaved(true);
          } catch (e) {
            setFormError(applyApiError(e, setError, ["name", "phone", "locale"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" autoComplete="name" {...register("name")} error={errors.name?.message} />
          <Field label="Phone" type="tel" autoComplete="tel" placeholder="010-1234-5678" {...register("phone")} error={errors.phone?.message} />
          <div className="sm:col-span-2">
            <label htmlFor="f-email" className="mb-1.5 block text-sm font-semibold">
              Email
            </label>
            <input id="f-email" value={email} readOnly disabled className={cn(inputClass(false), "cursor-not-allowed opacity-70")} aria-describedby="f-email-hint" />
            <p id="f-email-hint" className="mt-1.5 text-sm text-muted">
              Your sign-in email cannot be changed here. Contact us if you need to update it.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Language</legend>
          <div className="inline-flex rounded-control border border-line bg-background p-1">
            {(
              [
                ["en", "English"],
                ["ko", "한국어"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-[calc(var(--radius-control,12px)-4px)] px-5 py-2 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  locale === value ? "bg-accent text-on-accent" : "text-muted hover:text-foreground",
                )}
              >
                <input type="radio" value={value} className="sr-only" {...register("locale")} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface/40 p-4">
          <div>
            <p id="mk-label" className="text-sm font-semibold">
              Offers and news
            </p>
            <p className="text-sm text-muted">Premieres, member deals and event screenings by email.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!marketing}
            aria-labelledby="mk-label"
            onClick={() => setValue("marketing_opt_in", !marketing, { shouldDirty: true })}
            className={cn("relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition", marketing ? "bg-accent" : "bg-line")}
          >
            <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", marketing ? "left-6" : "left-1")} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          {saved && !isDirty ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-4" aria-hidden /> Saved
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

// --- Security -----------------------------------------------------------------

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

const RULES: [string, (p: string) => boolean][] = [
  ["10+ characters", (p) => p.length >= 10],
  ["Lowercase letter", (p) => /[a-z]/.test(p)],
  ["Uppercase letter", (p) => /[A-Z]/.test(p)],
  ["Number", (p) => /[0-9]/.test(p)],
];

function PasswordPanel() {
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const pw = useWatch({ control, name: "password" }) ?? "";
  const passed = RULES.filter(([, ok]) => ok(pw)).length;
  const type = show ? "text" : "password";

  return (
    <Card title="Password" hint="Changing it signs you out on every other device.">
      <form
        noValidate
        aria-label="Change password"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          setDone(false);
          try {
            await authApi.changePassword(v);
            reset();
            setDone(true);
          } catch (e) {
            setFormError(applyApiError(e, setError, ["current_password", "password", "password_confirmation"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>
        <Field label="Current password" type={type} autoComplete="current-password" {...register("current_password")} error={errors.current_password?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" type={type} autoComplete="new-password" {...register("password")} error={errors.password?.message} />
          <Field label="Confirm new password" type={type} autoComplete="new-password" {...register("password_confirmation")} error={errors.password_confirmation?.message} />
        </div>

        <div aria-live="polite">
          <div className="flex gap-1.5" aria-hidden>
            {RULES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition",
                  i < passed ? (passed === RULES.length ? "bg-emerald-500" : passed >= 2 ? "bg-amber-500" : "bg-rose-500") : "bg-line",
                )}
              />
            ))}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
            {RULES.map(([label, ok]) => (
              <li key={label} className={cn("flex items-center gap-1.5", ok(pw) ? "text-emerald-600 dark:text-emerald-400" : "text-muted")}>
                <span className={cn("size-1.5 rounded-full", ok(pw) ? "bg-emerald-500" : "bg-line")} aria-hidden />
                {label}
                <span className="sr-only">{ok(pw) ? " (met)" : " (not met)"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {show ? "Hide" : "Show"} passwords
          </Button>
          {done ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-4" aria-hidden /> Updated. Other devices were signed out.
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function TwoFactorCard({ user }: { user: AuthUser }) {
  if (!user.is_staff) return null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("grid size-11 place-items-center rounded-2xl", user.mfa.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500")}>
            <ShieldCheck className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-semibold">Two-factor authentication</p>
            <p className="text-sm text-muted">
              {user.mfa.enabled ? "On. Your staff sign-in asks for an authenticator code." : "Off. Staff accounts must set it up at the next staff sign-in."}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">Roles: {user.roles.join(", ") || "—"}</p>
      </div>
    </Card>
  );
}

// --- Devices ------------------------------------------------------------------

/** "Mozilla/5.0 (Windows NT 10.0…) Chrome/…" -> { label: "Chrome on Windows", mobile: false }. */
function describeAgent(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const mobile = /Mobile|iPhone|Android/.test(ua);
  const label = browser && os ? `${browser} on ${os}` : browser ?? os ?? (ua || "Unknown device");
  return { label, mobile };
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Active now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await authApi.sessions());
    } catch {
      setError("Could not load sessions.");
    }
  }, []);
  useEffect(() => {
    let live = true;
    authApi
      .sessions()
      .then((rows) => live && setSessions(rows))
      .catch(() => live && setError("Could not load sessions."));
    return () => {
      live = false;
    };
  }, []);

  const others = sessions?.filter((s) => !s.current) ?? [];
  const ordered = sessions ? [...sessions].sort((a, b) => Number(b.current) - Number(a.current)) : [];

  async function revoke(ids: string[]) {
    setBusy(ids.length > 1 ? "all" : ids[0]!);
    setError(null);
    try {
      for (const id of ids) await authApi.revokeSession(id);
    } catch {
      setError("Could not sign out every device. Try again.");
    } finally {
      setBusy(null);
      await load();
    }
  }

  return (
    <Card title="Signed-in devices" hint="Sign out anywhere you don't recognise. If something looks wrong, change your password too.">
      <FormMessage>{error}</FormMessage>
      {sessions === null && !error ? <div className="h-32 animate-pulse rounded-control bg-surface" /> : null}
      <ul className="space-y-3">
        {ordered.map((s) => {
          const d = describeAgent(s.user_agent);
          const Icon = d.mobile ? Smartphone : Monitor;
          return (
            <li key={s.id} className={cn("flex items-center gap-4 rounded-control border p-4", s.current ? "border-accent/50 bg-accent/5" : "border-line")}>
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface">
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate" title={s.user_agent}>
                    {d.label}
                  </span>
                  {s.current ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-text">This device</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {s.ip ?? "Unknown IP"} · {s.current ? "Active now" : timeAgo(s.last_active_at)}
                </p>
              </div>
              {!s.current ? (
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => revoke([s.id])}>
                  {busy === s.id ? "Signing out…" : "Sign out"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {others.length > 1 ? (
        <div className="mt-5 border-t border-line pt-5">
          <Button
            variant="secondary"
            disabled={busy !== null}
            className="text-rose-500 hover:border-rose-500 hover:text-rose-500"
            onClick={async () => {
              if (
                await confirmDialog({
                  title: `Sign out ${others.length} other devices?`,
                  message: "You stay signed in on this device.",
                  confirmLabel: "Sign out all",
                  danger: true,
                })
              ) {
                await revoke(others.map((s) => s.id));
              }
            }}
          >
            <LogOut className="size-4" aria-hidden />
            {busy === "all" ? "Signing out…" : "Sign out all other devices"}
          </Button>
        </div>
      ) : null}
      {sessions && others.length === 0 ? <p className="mt-4 text-sm text-muted">You&apos;re only signed in on this device.</p> : null}
    </Card>
  );
}
