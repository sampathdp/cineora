"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, RefreshCw } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { fetchSeats, type ApiSeat, type ApiShowtime } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { groupSeats } from "@/lib/seats";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { SeatSelector } from "./seat-selector";

interface State {
  key: string;
  seats?: ApiSeat[];
  bookable?: boolean;
  error?: string;
}

/** Fetches the live seat state for a showtime and renders the selectable map. */
export function LiveSeatMap({ showtime, embedded }: { showtime: ApiShowtime; embedded?: boolean }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<State | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${showtime.id}:${nonce}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchSeats(showtime.id, controller.signal)
      .then((r) => setState({ key, seats: r.seats, bookable: r.bookable }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const gone = e instanceof ApiError && e.status === 404;
        setState({ key, error: gone ? "This showtime is no longer available." : "Could not load the seat map. Check your connection and try again." });
      });
    return () => controller.abort();
  }, [showtime.id, key]);

  const rows = useMemo(() => (state?.seats ? groupSeats(state.seats) : null), [state]);
  const ready = state?.key === key ? state : null;

  // Seat booking needs an account: guests are sent to sign in (or register) and come back here afterwards.
  if (status === "anonymous") {
    const next = encodeURIComponent(pathname + (typeof window !== "undefined" ? window.location.search : ""));
    return (
      <EmptyState
        title="Sign in to book seats"
        description="Please sign in or create an account to choose your seats and book tickets."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/login?next=${next}`} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover">
              <LogIn className="size-4" aria-hidden /> Sign in
            </Link>
            <Link href={`/register?next=${next}`} className="inline-flex min-h-11 items-center rounded-control border border-line px-6 font-semibold hover:border-accent">
              Create account
            </Link>
          </div>
        }
      />
    );
  }

  if (!ready || status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading seat map">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (ready.error || !rows) {
    return (
      <EmptyState
        title="Seat map unavailable"
        description={ready.error}
        action={
          <Button variant="secondary" onClick={() => setNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className="size-4" aria-hidden /> Refresh availability
        </Button>
      </div>
      <SeatSelector key={key} showtime={showtime} rows={rows} bookable={ready.bookable ?? false} embedded={embedded} />
    </div>
  );
}
