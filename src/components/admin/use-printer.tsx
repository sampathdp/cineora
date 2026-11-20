"use client";

import { useCallback, useEffect, useState } from "react";
import { Bluetooth, BluetoothOff, Printer } from "lucide-react";
import type { ScanResult } from "@/lib/api/admin";
import { BluetoothPrinter, bluetoothSupported, type TicketSlip } from "@/lib/bluetooth-printer";
import { formatTime, zonedParts } from "@/lib/formatters";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

// One connection per tab, so it survives navigating between admin pages.
let shared: BluetoothPrinter | null = null;

export function slipFor(ticket: NonNullable<ScanResult["ticket"]>): TicketSlip {
  const { date, time } = zonedParts(ticket.starts_at, "Asia/Seoul");
  return {
    title: siteConfig.name,
    movie: ticket.movie,
    hall: ticket.room,
    seat: ticket.seat,
    category: ticket.category,
    showtime: `${date} ${formatTime(time)}`,
    reference: ticket.reference,
    qr: ticket.reference,
    footer: "Admitted. Enjoy the show!",
  };
}

export function usePrinter() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Read on the client only: navigator does not exist during the static export.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(bluetoothSupported());
    setName(shared?.name ?? null);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      shared ??= new BluetoothPrinter();
      setName(await shared.connect(() => setName((n) => n && `${n} (asleep)`)));
    } catch (e) {
      // Closing the picker is not an error worth showing.
      if (!(e instanceof DOMException && e.name === "NotFoundError")) setError(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    shared?.disconnect();
    setName(null);
  }, []);

  const print = useCallback(async (ticket: NonNullable<ScanResult["ticket"]>) => {
    if (!shared?.name) return setError("Connect a Bluetooth printer first.");
    setError(null);
    setBusy(true);
    try {
      await shared.printTicket(slipFor(ticket));
      setName(shared.name);
    } catch (e) {
      setError(e instanceof Error ? `Print failed: ${e.message}` : "Print failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { name, busy, error, supported, connect, disconnect, print };
}

/** Connect / disconnect control for the shared printer. */
export function PrinterControl({ printer }: { printer: ReturnType<typeof usePrinter> }) {
  if (!printer.supported) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <BluetoothOff className="size-4 shrink-0" aria-hidden />
        Bluetooth printing needs Chrome or Edge (desktop or Android) over https://.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {printer.name ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Printer className="size-4 text-emerald-500" aria-hidden />
              {printer.name}
            </span>
            <Button variant="ghost" size="sm" onClick={printer.disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={printer.connect} disabled={printer.busy}>
            <Bluetooth className="size-4" aria-hidden />
            {printer.busy ? "Connecting…" : "Connect Bluetooth printer"}
          </Button>
        )}
      </div>
      {printer.error && <p className="text-xs text-rose-500">{printer.error}</p>}
    </div>
  );
}
