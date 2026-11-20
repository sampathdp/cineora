import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieEditorPage } from "@/components/admin/movies-admin";

export const metadata: Metadata = { title: "Edit movie" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MovieEditorPage />
    </Suspense>
  );
}
