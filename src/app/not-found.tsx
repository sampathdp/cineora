import { Film } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-page flex min-h-[70vh] flex-col items-center justify-center gap-5 pt-24 text-center">
      <Film className="size-14 text-accent-text" aria-hidden />
      <p className="eyebrow">Error 404</p>
      <h1 className="display text-5xl sm:text-7xl">Scene not found</h1>
      <p className="max-w-md text-muted">The page you are looking for has been cut from the final edit, or never existed.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <LinkButton href="/" size="lg">
          Back to Home
        </LinkButton>
        <LinkButton href="/movies" size="lg" variant="secondary">
          Browse Movies
        </LinkButton>
      </div>
    </section>
  );
}
