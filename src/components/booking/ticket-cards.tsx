"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import type { TicketInfo } from "@/lib/api/payments";
import { formatISODate, formatTime, zonedParts } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LABEL: Record<TicketInfo["status"], string> = { valid: "Valid", used: "Used", cancelled: "Cancelled", refunded: "Refunded", void: "On hold" };

/** One ticket with its QR. The QR is drawn in the browser from an opaque token; it contains nothing personal. */
export function TicketCard({ ticket }: { ticket: TicketInfo }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket.qr) return;
    let live = true;
    QRCode.toDataURL(ticket.qr, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((url) => live && setQr(url))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ticket.qr]);

  const when = zonedParts(ticket.starts_at, ticket.cinema.timezone);
  const usable = ticket.status === "valid";

  return (
    <article className={cn("overflow-hidden rounded-card border border-line bg-elevated shadow-card print:break-inside-avoid", !usable && "opacity-75")} aria-label={`Ticket for seat ${ticket.seat}`}>
      <div className="on-dark bg-black p-5">
        <p className="eyebrow">{ticket.cinema.name}</p>
        <h3 className="display mt-1 text-3xl">{ticket.movie.title}</h3>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Item label="Date" value={formatISODate(when.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
          <Item label="Time" value={formatTime(when.time)} />
          <Item label="Room" value={ticket.room} />
          <Item label="Seat" value={`${ticket.seat} · ${ticket.category}`} />
          <Item label="Ticket" value={<span className="break-all font-mono text-xs">{ticket.reference}</span>} />
          <Item label="Status" value={LABEL[ticket.status]} />
        </dl>
        <div className="flex flex-col items-center gap-1">
          {ticket.qr ? (
            qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated data URL
              <img src={qr} alt={`QR code for seat ${ticket.seat}`} width={160} height={160} className="rounded bg-white p-1" />
            ) : (
              <div className="size-40 animate-pulse rounded bg-surface" aria-hidden />
            )
          ) : (
            <p className="grid size-40 place-items-center rounded bg-surface p-3 text-center text-xs text-muted">No QR available for this ticket</p>
          )}
          <p className="text-xs text-muted">Show this at the door</p>
        </div>
      </div>
    </article>
  );
}

export function TicketList({ tickets }: { tickets: TicketInfo[] }) {
  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print tickets
        </Button>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {tickets.map((t) => (
          <li key={t.id}>
            <TicketCard ticket={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
