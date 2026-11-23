"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { AuthCard, inputClass } from "./form-kit";
import { VerifyCodeForm } from "./verify-code-form";

/**
 * Email verification. Normally the customer types the 6-digit code from the email here (?email= prefills it).
 * Older signed links still land here with ?status= after the server has verified them.
 */
export function VerifyEmailStatus() {
  const params = useSearchParams();
  const status = params.get("status");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [verified, setVerified] = useState(status === "success");
  const { refresh } = useAuth();

  useEffect(() => {
    if (verified) void refresh();
  }, [verified, refresh]);

  if (verified || status) {
    return (
      <AuthCard title={verified ? "Email verified" : "Link not valid"}>
        <div role="status" className="flex flex-col gap-3">
          {verified ? <CheckCircle2 className="size-8 text-accent-text" aria-hidden /> : <XCircle className="size-8 text-red-500" aria-hidden />}
          <p className="text-muted">
            {verified ? "Thanks, your email address is confirmed. You can book tickets now." : "This verification link is invalid or has expired. Request a new code below."}
          </p>
          <Link href={verified ? "/movies" : "/verify-email"} className="font-semibold text-accent-text hover:underline">
            {verified ? "Browse movies" : "Get a new code"}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verify your email" subtitle="Enter the 6-digit code we emailed you.">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Email
          <input type="email" autoComplete="email" className={inputClass(false)} value={email} onChange={(e) => setEmail(e.target.value.trim())} />
        </label>
        {email.includes("@") ? <VerifyCodeForm email={email} onVerified={() => setVerified(true)} /> : null}
      </div>
    </AuthCard>
  );
}
