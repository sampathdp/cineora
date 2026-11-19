import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Film, ShieldCheck } from "lucide-react";
import { StaffLogin } from "@/components/auth/staff-login";

export const metadata: Metadata = {
  title: "Operations Console Sign In",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Ops Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="mb-4 flex items-center gap-2.5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover text-on-accent shadow-lg shadow-accent/25">
              <Film className="size-6" />
            </div>
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-surface/80 px-3 py-1 text-xs font-semibold text-muted mb-2">
            <ShieldCheck className="size-3.5 text-accent" />
            <span>CINEORA OPERATIONS CONSOLE</span>
          </div>
          <p className="text-xs text-muted">Authorised staff & cinema management portal</p>
        </div>

        <div className="[&>section]:p-0 [&>section]:min-h-0 [&>section]:pt-0 [&>section]:pb-0">
          <Suspense>
            <StaffLogin />
          </Suspense>
        </div>

        <p className="mt-8 text-center text-xs text-muted/80">
          Protected by enterprise multi-factor authentication (TOTP). All access attempts are cryptographically signed & logged.
        </p>
      </div>
    </div>
  );
}
