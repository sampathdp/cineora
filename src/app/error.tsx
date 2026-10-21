"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page flex min-h-[70vh] flex-col items-center justify-center gap-5 pt-24 text-center">
      <TriangleAlert className="size-14 text-accent-text" aria-hidden />
      <h1 className="display text-5xl sm:text-6xl">Something went wrong</h1>
      <p className="max-w-md text-muted">An unexpected error interrupted the show. Please try again.</p>
      <Button size="lg" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
