import type { Metadata } from "next";
import { Suspense } from "react";
import { CinemaEditorPage } from "@/components/admin/cinemas-admin";

export const metadata: Metadata = { title: "New cinema" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CinemaEditorPage />
    </Suspense>
  );
}
