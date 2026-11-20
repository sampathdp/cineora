import type { Metadata } from "next";
import { Suspense } from "react";
import { RemoteScanner } from "@/components/admin/remote-scanner";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Phone scanner", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading label="Loading scanner" />}>
      <RemoteScanner />
    </Suspense>
  );
}
