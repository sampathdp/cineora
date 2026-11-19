"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { safeRedirect } from "@/lib/safe-redirect";
import { AuthCard, Field, FormMessage, applyApiError } from "./form-kit";

type Step = "credentials" | "challenge" | "setup" | "recovery";

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

/** Staff portal sign-in: credentials, then TOTP challenge or first-time TOTP enrolment. */
export function StaffLogin() {
  const { staffLogin, refresh } = useAuth();
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("next"), "/admin");
  const [step, setStep] = useState<Step>("credentials");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const done = async () => {
    await refresh();
    router.replace(next);
  };

  if (step === "challenge") return <ChallengeStep onDone={done} />;
  if (step === "setup") {
    return (
      <SetupStep
        onDone={(codes) => {
          setRecoveryCodes(codes);
          setStep("recovery");
        }}
      />
    );
  }
  if (step === "recovery") return <RecoveryStep codes={recoveryCodes} onDone={done} />;

  return (
    <CredentialsStep
      onSubmit={async (v) => {
        const r = await staffLogin(v.email, v.password);
        if (r.mfa_required) setStep("challenge");
        else if (r.mfa_setup_required) setStep("setup");
        else await done();
      }}
    />
  );
}

function CredentialsStep({ onSubmit }: { onSubmit: (v: z.infer<typeof credSchema>) => Promise<void> }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof credSchema>>({ resolver: zodResolver(credSchema) });

  return (
    <AuthCard title="Staff sign in" subtitle="Authorised personnel only. Activity is logged.">
      <form
        noValidate
        aria-label="Staff sign in"
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          try {
            await onSubmit(v);
          } catch (e) {
            setFormError(applyApiError(e, setError, ["email", "password"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>
        <Field label="Email" type="email" autoComplete="username" {...register("email")} error={errors.email?.message} />
        <Field label="Password" type="password" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </AuthCard>
  );
}

function ChallengeStep({ onDone }: { onDone: () => Promise<void> }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.mfaChallenge(useRecovery ? { recovery_code: value.trim() } : { code: value.trim() });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldError("code") ?? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Two-factor check" subtitle={useRecovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app."}>
      <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Two-factor verification">
        <FormMessage>{error}</FormMessage>
        <Field
          label={useRecovery ? "Recovery code" : "Authentication code"}
          inputMode={useRecovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={useRecovery ? 32 : 6}
          autoFocus
        />
        <Button type="submit" size="lg" disabled={busy || value.length < 6}>
          {busy ? "Verifying…" : "Verify"}
        </Button>
        <button
          type="button"
          className="text-sm font-semibold text-accent-text hover:underline"
          onClick={() => {
            setUseRecovery((v) => !v);
            setValue("");
            setError(null);
          }}
        >
          {useRecovery ? "Use authenticator code instead" : "Use a recovery code"}
        </button>
      </form>
    </AuthCard>
  );
}

function SetupStep({ onDone }: { onDone: (codes: string[]) => void }) {
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enrolment) return;
    let live = true;
    QRCode.toDataURL(enrolment.otpauth_uri, { margin: 1, width: 192 }).then((url) => live && setQr(url)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enrolment]);

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setEnrolment(await authApi.mfaSetup(password));
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldError("password") ?? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone((await authApi.mfaConfirm(code.trim())).recovery_codes);
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldError("code") ?? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!enrolment) {
    return (
      <AuthCard title="Set up two-factor" subtitle="Staff accounts must use an authenticator app. Confirm your password to begin.">
        <form onSubmit={begin} className="flex flex-col gap-5" aria-label="Start two-factor setup">
          <FormMessage>{error}</FormMessage>
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" disabled={busy || !password}>
            Continue
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Scan and confirm" subtitle="Scan the code with your authenticator app, then enter the 6-digit code it shows.">
      <form onSubmit={confirm} className="flex flex-col gap-5" aria-label="Confirm two-factor setup">
        <FormMessage>{error}</FormMessage>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, not a remote image */}
        {qr ? <img src={qr} alt="Authenticator QR code" width={192} height={192} className="mx-auto rounded bg-white p-1" /> : null}
        <p className="break-all text-center font-mono text-xs text-muted">Or enter manually: {enrolment.secret}</p>
        <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Enable two-factor"}
        </Button>
      </form>
    </AuthCard>
  );
}

function RecoveryStep({ codes, onDone }: { codes: string[]; onDone: () => Promise<void> }) {
  const [saved, setSaved] = useState(false);
  return (
    <AuthCard title="Save your recovery codes" subtitle="Each code works once if you lose your authenticator. They are shown only now.">
      <ul className="grid grid-cols-2 gap-2 rounded-control border border-line bg-background p-4 font-mono text-sm" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <label className="mt-5 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I have stored these codes somewhere safe.
      </label>
      <Button size="lg" className="mt-5 w-full" disabled={!saved} onClick={() => void onDone()}>
        Finish
      </Button>
    </AuthCard>
  );
}
