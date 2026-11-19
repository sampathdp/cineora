"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { paymentsApi, type TicketInfo } from "@/lib/api/payments";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { BackLink, EmptyState, Skeleton } from "@/components/ui/misc";
import { FormMessage } from "@/components/auth/form-kit";
import { TicketList } from "./ticket-cards";

export function MyTickets() {
  const { status } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<{ tickets?: TicketInfo[]; error?: string } | null>(null);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/account/tickets");
    if (status !== "authenticated") return;
    let live = true;
    paymentsApi
      .myTickets()
      .then((tickets) => live && setState({ tickets }))
      .catch(() => live && setState({ error: "Could not load your tickets. Please try again." }));
    return () => {
      live = false;
    };
  }, [status, router]);

  return (
    <section className="container-page pb-20 pt-28 sm:pt-32">
      <BackLink href="/account">Account</BackLink>
      <h1 className="display mt-2 text-4xl sm:text-6xl">My tickets</h1>
      <div className="mt-8">
        {!state ? (
          <Skeleton className="h-48" />
        ) : state.error ? (
          <FormMessage>{state.error}</FormMessage>
        ) : state.tickets?.length ? (
          <TicketList tickets={state.tickets} />
        ) : (
          <EmptyState title="No tickets yet" description="Tickets appear here once your payment has been verified." action={<Link href="/account/bookings" className="font-semibold text-accent-text hover:underline">My bookings</Link>} />
        )}
      </div>
    </section>
  );
}
