import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/auth/account-view";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
