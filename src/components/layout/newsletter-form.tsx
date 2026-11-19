"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { publicForms } from "@/lib/api/content";
import { ApiError } from "@/lib/api/client";

const schema = z.string().trim().email("Enter a valid email address.");

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setDone(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await publicForms.newsletter(parsed.data);
      setDone(true);
      setEmail("");
    } catch (err) {
      setDone(false);
      setError(err instanceof ApiError && err.status === 429 ? "Too many attempts. Please try again later." : "Could not subscribe right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Newsletter signup">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          aria-describedby="newsletter-msg"
          className="h-11 min-w-0 flex-1 rounded-control border border-line bg-background px-3 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <Button type="submit" size="md" disabled={busy}>
          Subscribe
        </Button>
      </div>
      <p id="newsletter-msg" role="status" className="mt-2 min-h-5 text-sm">
        {error ? (
          <span className="text-red-500 dark:text-red-400">⚠ {error}</span>
        ) : done ? (
          <span className="text-accent-text">✓ You are subscribed. Thank you!</span>
        ) : (
          <span className="text-muted">Premieres, special screenings and offers.</span>
        )}
      </p>
    </form>
  );
}
