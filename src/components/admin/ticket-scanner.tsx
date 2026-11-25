"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Camera, CameraOff, CheckCircle2, Printer, QrCode, ScanLine, Smartphone, XCircle } from "lucide-react";
import { adminApi, type ScanResult } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatTime, zonedParts } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-kit";
import { PageTitle } from "./kit";
import { cn } from "@/lib/utils";
import { useQrCamera } from "./use-qr-camera";
import { useHidScanner } from "./use-hid-scanner";
import { PrinterControl, usePrinter } from "./use-printer";

/** A 26-character ULID is a ticket reference (printed slips); anything else is a signed QR payload. */
export const scanInput = (v: string) => (/^[0-9A-Za-z]{26}$/.test(v) ? { reference: v } : { code: v });

const TITLE: Record<ScanResult["result"], string> = {
  valid: "VALID: ADMIT ONE",
  already_used: "ALREADY USED",
  cancelled: "CANCELLED TICKET",
  refunded: "REFUNDED TICKET",
  wrong_showtime: "WRONG SHOWTIME / NOT OPEN",
  invalid: "INVALID TICKET CODE",
  void: "ON HOLD / VOID",
};

export function TicketScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState<{ outcome: string; seat: string | null; at: string | null }[]>([]);
  const busyRef = useRef(false);
  const printer = usePrinter();
  const [autoPrint, setAutoPrint] = useState(false);
  const autoPrintRef = useRef(autoPrint);
  useEffect(() => {
    autoPrintRef.current = autoPrint;
  }, [autoPrint]);
  const printRef = useRef(printer.print);
  useEffect(() => {
    printRef.current = printer.print;
  }, [printer.print]);

  const [popup, setPopup] = useState<Popup | null>(null);
  const popupSeq = useRef(0);
  const flash = useCallback((p: Omit<Popup, "id">) => {
    beep(p.ok);
    setPopup({ ...p, id: ++popupSeq.current });
  }, []);

  /** Every result, whether from this device or the paired phone, lands here. */
  const show = useCallback((r: ScanResult) => {
    setResult(r);
    flash({ ok: r.result === "valid", title: TITLE[r.result], message: r.message, ticket: r.ticket ?? null });
    if (r.result === "valid" && r.ticket && autoPrintRef.current) void printRef.current(r.ticket);
  }, [flash]);

  const loadRecent = useCallback(() => {
    adminApi.recentScans().then(setRecent).catch(() => undefined);
  }, []);
  useEffect(loadRecent, [loadRecent]);

  const validate = useCallback(
    async (input: { code?: string; reference?: string }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        show(await adminApi.validateTicket(input));
        loadRecent();
      } catch (e) {
        setResult(null);
        const message =
          e instanceof ApiError
            ? e.status === 429
              ? "Scanning too fast. Please wait a moment."
              : e.message
            : "Could not reach the server.";
        setError(message);
        flash({ ok: false, title: "SCAN FAILED", message, ticket: null });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [loadRecent, show, flash],
  );

  const { camera, cameraError, start: startCamera, stop: stopCamera, videoRef, canvasRef } = useQrCamera((code) => void validate(scanInput(code)));
  const [scannerLastAt, setScannerLastAt] = useState<Date | null>(null);
  useHidScanner((code) => {
    setScannerLastAt(new Date());
    void validate(scanInput(code.trim()));
  });

  // --- Paired phone camera ---
  const [pair, setPair] = useState<{ token: string; url: string; qr: string } | null>(null);
  const [phoneOnline, setPhoneOnline] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const seqRef = useRef(0);

  async function connectPhone() {
    setPairError(null);
    try {
      const { token } = await adminApi.createScannerPair();
      const url = `${window.location.origin}/admin/scan-remote/?t=${encodeURIComponent(token)}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 280 });
      seqRef.current = 0;
      setPair({ token, url, qr });
    } catch (e) {
      setPairError(e instanceof ApiError ? e.message : "Could not create a phone link.");
    }
  }

  function disconnectPhone() {
    if (pair) void adminApi.endScannerPair(pair.token).catch(() => undefined);
    setPair(null);
    setPhoneOnline(false);
  }

  useEffect(() => {
    if (!pair) return;
    let alive = true;
    const poll = async () => {
      try {
        const { connected, events } = await adminApi.scannerPairEvents(pair.token, seqRef.current);
        if (!alive) return;
        setPhoneOnline(connected);
        if (events.length) {
          seqRef.current = events[events.length - 1].seq;
          show(events[events.length - 1].result);
          setError(null);
          loadRecent();
        }
      } catch (e) {
        if (alive && e instanceof ApiError && e.status === 404) {
          setPair(null);
          setPhoneOnline(false);
          setPairError("Phone link expired. Connect again.");
        }
      }
    };
    const timer = setInterval(poll, 1500);
    void poll();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pair, show, loadRecent]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    void validate(scanInput(v));
    setManual("");
  }

  const ok = result?.result === "valid";

  return (
    <section className="space-y-6">
      {popup ? <ScanPopup key={popup.id} popup={popup} onClose={() => setPopup(null)} /> : null}
      <PageTitle
        title="Door Scanner & Ticket Admissions"
        eyebrow="Admissions Gate"
        icon={ScanLine}
        hint="Scan with a USB/Bluetooth barcode scanner or the device camera, or type a ticket reference for instant validation."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left Column: Camera Viewport & Manual Code Input */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-black shadow-xl">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn("aspect-video w-full object-cover", camera !== "on" && "absolute inset-0 opacity-0")}
              aria-label="Camera preview"
            />

            {/* Viewfinder Reticle Overlay */}
            {camera === "on" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative size-52 sm:size-64 rounded-3xl border-2 border-accent/80 shadow-[0_0_30px_rgba(233,111,37,0.35)]">
                  {/* High tech corner brackets */}
                  <div className="absolute -top-1.5 -left-1.5 size-6 border-t-4 border-l-4 border-accent rounded-tl-xl" />
                  <div className="absolute -top-1.5 -right-1.5 size-6 border-t-4 border-r-4 border-accent rounded-tr-xl" />
                  <div className="absolute -bottom-1.5 -left-1.5 size-6 border-b-4 border-l-4 border-accent rounded-bl-xl" />
                  <div className="absolute -bottom-1.5 -right-1.5 size-6 border-b-4 border-r-4 border-accent rounded-br-xl" />
                  {/* Laser scan line animation */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-accent/80 shadow-[0_0_12px_rgba(233,111,37,1)] animate-pulse" />
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {camera !== "on" && (
              <div className="grid aspect-video place-items-center p-8 text-center text-white/70">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                    <Camera className="size-7" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-white">
                      {camera === "starting" ? "Initializing camera device…" : "Scanner Camera Inactive"}
                    </p>
                    <p className="text-xs text-white/60 mt-1 max-w-sm">
                      Click below to activate device camera scanning or use manual ticket code entry.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {camera === "on" ? (
              <Button variant="secondary" onClick={stopCamera} className="shadow-sm cursor-pointer">
                <CameraOff className="size-4 mr-1.5" aria-hidden />
                <span>Turn Off Camera</span>
              </Button>
            ) : (
              <Button onClick={startCamera} disabled={camera === "starting"} className="shadow-sm cursor-pointer">
                <Camera className="size-4 mr-1.5" aria-hidden />
                <span>{camera === "starting" ? "Starting…" : "Activate Camera Scanner"}</span>
              </Button>
            )}
            {!pair && (
              <Button variant="secondary" onClick={connectPhone} className="shadow-sm cursor-pointer">
                <Smartphone className="size-4 mr-1.5" aria-hidden />
                <span>Use phone as camera</span>
              </Button>
            )}
          </div>

          {pair && (
            <div className="flex flex-col gap-4 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL */}
              <img src={pair.qr} alt="QR code to open the phone scanner" className="size-40 shrink-0 self-center rounded-xl bg-white p-1.5" />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p className="flex items-center gap-2 font-bold text-foreground">
                  <span className={cn("size-2.5 rounded-full", phoneOnline ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                  {phoneOnline ? "Phone connected: scans appear here" : "Waiting for phone…"}
                </p>
                <p className="text-xs text-muted">
                  Scan this code with the phone camera and open the link. The phone scans tickets as you; results show on this screen.
                  The link works for 8 hours or until you disconnect.
                </p>
                <p className="truncate font-mono text-[11px] text-muted/80">{pair.url}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(pair.url)}>
                    Copy link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={disconnectPhone}>
                    Disconnect phone
                  </Button>
                </div>
              </div>
            </div>
          )}
          {pairError && <FormMessage>{pairError}</FormMessage>}

          {camera === "insecure" && (
            <FormMessage>This browser only allows the camera on https:// pages. Use &quot;Use phone as camera&quot; or manual entry.</FormMessage>
          )}
          {camera === "denied" && (
            <FormMessage>{cameraError}</FormMessage>
          )}

          {/* Manual Entry Form */}
          <form
            onSubmit={submitManual}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm"
            aria-label="Manual ticket entry"
          >
            <div className="flex-1">
              <label htmlFor="manual" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Ticket Reference / QR Payload (Manual)
              </label>
              <input
                id="manual"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                placeholder="Paste or type printed code (e.g. 26-char ULID)…"
                className="h-11 w-full rounded-xl border border-line/70 bg-background/90 px-3.5 text-sm font-mono outline-none focus:border-accent"
              />
            </div>
            <Button type="submit" disabled={busy || !manual.trim()} className="h-11 shadow-sm cursor-pointer">
              <ScanLine className="size-4 mr-1.5" />
              <span>Validate Code</span>
            </Button>
          </form>

          {error && <FormMessage>{error}</FormMessage>}
        </div>

        {/* Right Column: Admission Result & Recent Audit Log */}
        <div className="space-y-4">
          <div
            role="status"
            aria-live="assertive"
            className={cn(
              "rounded-3xl border-2 p-6 transition-all duration-200 shadow-sm backdrop-blur-sm",
              !result && "border-line/70 bg-elevated/70",
              result && ok && "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10",
              result && !ok && "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10",
            )}
          >
            {result ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center gap-3">
                  {ok ? (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
                      <CheckCircle2 className="size-6" />
                    </div>
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-500">
                      <XCircle className="size-6" />
                    </div>
                  )}
                  <div>
                    <h3 className={cn("text-lg font-extrabold tracking-tight", ok ? "text-emerald-500" : "text-rose-500")}>
                      {TITLE[result.result]}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">{result.message}</p>
                  </div>
                </div>

                {result.ticket && (
                  <div className="rounded-2xl border border-line/60 bg-surface/60 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-line/40 pb-2">
                      <span className="text-muted font-bold">Seat Assignment:</span>
                      <span className="font-mono font-extrabold text-accent text-sm">
                        {result.ticket.seat} ({result.ticket.category})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Hall:</span>
                      <span className="font-semibold text-foreground">{result.ticket.room}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Movie:</span>
                      <span className="font-semibold text-foreground truncate max-w-[160px]">
                        {result.ticket.movie}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Showtime:</span>
                      <span className="font-semibold text-foreground">
                        {formatTime(zonedParts(result.ticket.starts_at, "Asia/Seoul").time)}
                      </span>
                    </div>
                    {result.ticket.checked_in_at && (
                      <div className="flex items-center justify-between pt-1 border-t border-line/40 text-amber-500">
                        <span>Previously scanned:</span>
                        <span>{formatTime(zonedParts(result.ticket.checked_in_at, "Asia/Seoul").time)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted">
                <QrCode className="mx-auto size-8 opacity-30 mb-2" />
                <p className="text-sm font-semibold">{busy ? "Verifying ticket…" : "Ready to Scan"}</p>
                <p className="text-xs text-muted/80 mt-1">Point scanner at QR or enter code.</p>
              </div>
            )}
          </div>

          {/* Barcode scanner (keyboard/HID mode, paired in the OS, so there is nothing to connect here) */}
          <div className="space-y-2 rounded-3xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <ScanLine className="size-4" aria-hidden /> Barcode scanner
            </h3>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className={cn("size-2 rounded-full", scannerLastAt ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} aria-hidden />
              {scannerLastAt ? `Working · last scan ${scannerLastAt.toLocaleTimeString()}` : "Listening — scan any ticket to test"}
            </p>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none">How to connect a USB / Bluetooth scanner</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Set the scanner to <b>keyboard (HID) mode</b> with an <b>Enter suffix</b> using its setup barcodes.</li>
                <li>Pair it in the computer&apos;s Bluetooth settings (or plug in its USB base). It shows up as a keyboard.</li>
                <li>Keep this page open and don&apos;t click into a text box. Just scan.</li>
              </ol>
            </details>
          </div>

          {/* Ticket printer */}
          <div className="space-y-3 rounded-3xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <Printer className="size-4" aria-hidden /> Ticket printer
            </h3>
            <PrinterControl printer={printer} />
            {printer.name && (
              <>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="accent-accent" />
                  Auto-print every admitted ticket
                </label>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={printer.busy || !result?.ticket}
                  onClick={() => result?.ticket && void printer.print(result.ticket)}
                >
                  <Printer className="size-4" aria-hidden />
                  {printer.busy ? "Printing…" : result?.ticket ? `Print ticket (seat ${result.ticket.seat})` : "Scan a ticket to print"}
                </Button>
              </>
            )}
          </div>

          {/* Recent Scans Feed */}
          <div className="rounded-3xl border border-line/70 bg-elevated/70 p-5 shadow-sm backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
              <span>Recent Scans</span>
              <span className="text-[10px] text-muted/80 font-normal">Session history</span>
            </h3>

            <ul className="space-y-2 text-xs" aria-label="Recent scans">
              {recent.slice(0, 7).map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-line/50 bg-surface/50 px-3 py-2"
                >
                  <span className="font-mono font-bold text-foreground">
                    Seat {r.seat ?? "—"}
                  </span>
                  <span
                    className={cn(
                      "font-semibold uppercase text-[10px]",
                      r.outcome === "valid" ? "text-emerald-500 font-bold" : "text-rose-500",
                    )}
                  >
                    {r.outcome.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="py-3 text-center text-muted italic">No tickets scanned yet this session.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

interface Popup {
  id: number;
  ok: boolean;
  title: string;
  message: string;
  ticket: ScanResult["ticket"] | null;
}

/** Short high beep for admit, low double buzz for refuse. Silently skipped where audio is unavailable. */
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tones = ok ? [[880, 0, 0.15]] : [[220, 0, 0.18], [220, 0.24, 0.18]];
    for (const [freq, at, len] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = ok ? "sine" : "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + len);
    }
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // no audio: the popup is enough
  }
}

/** Full-screen admit / refuse card. Closes itself (faster on success), on click, or on Escape / Enter. */
function ScanPopup({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const ms = popup.ok ? 2500 : 4500;
  // The parent re-renders often (phone polling); keep the latest callback without restarting the timer.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), ms);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [ms]);

  const t = popup.ticket;
  const Icon = popup.ok ? CheckCircle2 : XCircle;

  return (
    <div
      className="fixed inset-0 z-[250] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scan-popup-title"
      aria-describedby="scan-popup-msg"
    >
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border-2 bg-elevated p-8 text-center shadow-2xl",
          popup.ok ? "border-emerald-500 shadow-emerald-500/30" : "border-rose-500 shadow-rose-500/30",
        )}
      >
        <div className={cn("mx-auto grid size-24 place-items-center rounded-full", popup.ok ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
          <Icon className="size-14" strokeWidth={2.5} aria-hidden />
        </div>
        <p className={cn("mt-5 text-xs font-bold uppercase tracking-[0.2em]", popup.ok ? "text-emerald-500" : "text-rose-500")}>
          {popup.ok ? "Success" : "Failed"}
        </p>
        <h2 id="scan-popup-title" className={cn("mt-1 text-3xl font-extrabold tracking-tight", popup.ok ? "text-emerald-500" : "text-rose-500")}>
          {popup.title}
        </h2>
        <p id="scan-popup-msg" className="mt-2 text-sm text-muted">
          {popup.message}
        </p>

        {t ? (
          <div className="mt-6 rounded-2xl border border-line/60 bg-surface/60 p-4 text-left text-sm">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <span className="text-muted">Seat</span>
              <span className="font-mono text-2xl font-extrabold text-accent">{t.seat}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted">Movie</span>
              <span className="truncate font-semibold">{t.movie}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted">Hall · time</span>
              <span className="font-semibold">
                {t.room} · {formatTime(zonedParts(t.starts_at, "Asia/Seoul").time)}
              </span>
            </div>
            {!popup.ok && t.checked_in_at ? (
              <div className="mt-1 flex justify-between gap-3 text-amber-500">
                <span>First scanned</span>
                <span className="font-semibold">{formatTime(zonedParts(t.checked_in_at, "Asia/Seoul").time)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mt-6 text-xs text-muted">Tap anywhere or press Enter to scan the next ticket</p>
        <span
          className={cn("absolute bottom-0 left-0 h-1", popup.ok ? "bg-emerald-500" : "bg-rose-500")}
          style={{ animation: `scan-popup-timer ${ms}ms linear forwards` }}
          aria-hidden
        />
        <style>{`@keyframes scan-popup-timer { from { width: 100%; } to { width: 0%; } }`}</style>
      </div>
    </div>
  );
}
