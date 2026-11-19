"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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

  if (!ready) {
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
