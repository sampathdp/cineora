"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { FormMessage, inputClass } from "./form-kit";

/** Six-digit email code entry, with a resend button. Calls onVerified once the server accepts the code. */
export function VerifyCodeForm({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const message = (e: unknown) =>
    e instanceof ApiError && e.status === 429 ? "Too many attempts. Please wait a minute and try again." : e instanceof ApiError ? e.message : "Something went wrong. Please try again.";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await authApi.verifyEmailCode(email, code);
      onVerified();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    try {
      await authApi.sendVerificationCode(email);
      setInfo("A new code is on its way. Check your inbox.");
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Verify email">
      <FormMessage>{error}</FormMessage>
      <FormMessage tone="info">{info}</FormMessage>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Verification code
        <input
          className={`${inputClass(!!error)} text-center font-mono text-2xl tracking-[0.5em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
        />
      </label>
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Checking…" : "Verify email"}
      </Button>
      <button type="button" onClick={resend} className="cursor-pointer self-start text-sm font-semibold text-accent-text hover:underline">
        Send a new code
      </button>
    </form>
  );
}
