import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { StaffLogin } from "@/components/auth/staff-login";
import { BrandImage } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: "Operations Console Sign In",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-background selection:bg-accent selection:text-on-accent overflow-hidden">
      {/* Background ambient lighting & subtle grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[32rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 size-[24rem] rounded-full bg-sky-500/5 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Console Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="mb-4 flex items-center gap-2.5 group">
            <BrandImage className="h-16 transition-transform group-hover:scale-105" />
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-bold text-accent mb-2 shadow-sm">
            <ShieldCheck className="size-3.5" />
            <span>OPERATIONS CONTROL CONSOLE</span>
          </div>
          <h1 className="display text-2xl font-extrabold text-foreground tracking-tight">
            Staff Portal Sign In
          </h1>
          <p className="text-xs text-muted mt-1">Authorised personnel and cinema management only</p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-line/80 bg-elevated/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl [&>section]:p-0 [&>section]:min-h-0 [&>section]:pt-0 [&>section]:pb-0">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface/50" />}>
            <StaffLogin />
          </Suspense>
        </div>

        {/* Security Notice Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted/80">
          <Lock className="size-3 text-accent" />
          <span>Protected by Time-based One-Time Password (TOTP) 2FA encryption.</span>
        </div>
      </div>
    </div>
  );
}
