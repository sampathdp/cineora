"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { AuthCard } from "./form-kit";

/** Landing page for the redirect from the signed email link. The server has already done the verification. */
export function VerifyEmailStatus() {
  const ok = useSearchParams().get("status") === "success";
  const { refresh } = useAuth();

  useEffect(() => {
    if (ok) void refresh();
  }, [ok, refresh]);

  return (
    <AuthCard title={ok ? "Email verified" : "Link not valid"}>
      <div role="status" className="flex flex-col gap-3">
        {ok ? <CheckCircle2 className="size-8 text-accent-text" aria-hidden /> : <XCircle className="size-8 text-red-500" aria-hidden />}
        <p className="text-muted">
          {ok ? "Thanks, your email address is confirmed. You can book tickets now." : "This verification link is invalid or has expired. Sign in and request a new one from your account page."}
        </p>
        <Link href={ok ? "/movies" : "/account"} className="font-semibold text-accent-text hover:underline">
          {ok ? "Browse movies" : "Go to your account"}
        </Link>
      </div>
    </AuthCard>
  );
}
