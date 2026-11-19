import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  );
}
