"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { authApi, type AccountProfile, type SessionInfo } from "@/lib/api/auth";
import { Field, FormMessage, applyApiError } from "./form-kit";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-elevated p-6">
      <h2 className="display text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AccountView() {
  const { status, user, logout, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) {
    return (
      <section className="container-page pb-16 pt-28" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      </section>
    );
  }

  return (
    <section className="container-page pb-20 pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="display text-4xl sm:text-5xl">{user.name}</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await logout();
            router.replace("/");
          }}
        >
          Sign out
        </Button>
      </div>

      {!user.email_verified ? <VerifyBanner /> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Bookings">
          <p className="text-muted">See your reservations, hold times and payment status.</p>
          <Link href="/account/bookings" className="mt-3 inline-block font-semibold text-accent-text hover:underline">
            My bookings
          </Link>
          <Link href="/account/tickets" className="ml-5 mt-3 inline-block font-semibold text-accent-text hover:underline">
            My tickets
          </Link>
        </Panel>
        <ProfilePanel onSaved={refresh} />
        <PasswordPanel />
        <SessionsPanel />
        {user.is_staff ? (
          <Panel title="Staff access">
            <p className="text-muted">
              Roles: {user.roles.join(", ")}. Two-factor authentication is {user.mfa.enabled ? "enabled" : "not enabled"}.
            </p>
            <Link href="/admin/login" className="mt-3 inline-block font-semibold text-accent-text hover:underline">
              Open the staff portal
            </Link>
          </Panel>
        ) : null}
      </div>
    </section>
  );
}

function VerifyBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-control border border-accent/50 bg-accent/10 p-4" role="status">
      <p className="text-sm">Please verify your email address before booking. Check your inbox for the link.</p>
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

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().regex(/^([0-9+\-\s()]{6,32})?$/, "Enter a valid phone number."),
  locale: z.enum(["en", "ko"]),
  marketing_opt_in: z.boolean(),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfilePanel({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    let live = true;
    authApi.profile().then((p: AccountProfile) => {
      if (live) reset({ name: p.user.name, phone: p.phone ?? "", locale: p.locale, marketing_opt_in: p.marketing_opt_in });
    }).catch(() => setFormError("Could not load your profile."));
    return () => {
      live = false;
    };
  }, [reset]);

  return (
    <Panel title="Profile">
      <form
        noValidate
        aria-label="Profile"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          setSaved(false);
          try {
            await authApi.updateProfile({ ...v, phone: v.phone || null });
            await onSaved();
            setSaved(true);
          } catch (e) {
            setFormError(applyApiError(e, setError, ["name", "phone", "locale"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>
        <Field label="Name" autoComplete="name" {...register("name")} error={errors.name?.message} />
        <Field label="Phone" type="tel" autoComplete="tel" {...register("phone")} error={errors.phone?.message} />
        <div>
          <label htmlFor="f-locale" className="mb-1.5 block text-sm font-semibold">
            Language
          </label>
          <select id="f-locale" {...register("locale")} className="h-12 w-full rounded-control border border-line bg-background px-3">
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" {...register("marketing_opt_in")} /> Email me offers and news
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          {saved ? (
            <span role="status" className="text-sm text-muted">
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

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

function PasswordPanel() {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  return (
    <Panel title="Change password">
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
        <Field label="Current password" type="password" autoComplete="current-password" {...register("current_password")} error={errors.current_password?.message} />
        <Field label="New password" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" {...register("password_confirmation")} error={errors.password_confirmation?.message} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
          {done ? (
            <span role="status" className="text-sm text-muted">
              Updated. Other devices were signed out.
            </span>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Panel title="Signed-in devices">
      <FormMessage>{error}</FormMessage>
      {sessions === null && !error ? <div className="h-16 animate-pulse rounded bg-surface" /> : null}
      {sessions?.length === 0 ? <p className="text-muted">No other sessions.</p> : null}
      <ul className="divide-y divide-line">
        {sessions?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{s.user_agent || "Unknown device"}</p>
              <p className="text-xs text-muted">
                {s.ip ?? "—"} · {new Date(s.last_active_at).toLocaleString()}
                {s.current ? " · this device" : ""}
              </p>
            </div>
            {!s.current ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await authApi.revokeSession(s.id);
                  await load();
                }}
              >
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
