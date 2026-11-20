"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api/client";
import type { ScanResult } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQrCamera } from "./use-qr-camera";
import { scanInput } from "./ticket-scanner";

/**
 * Opened on a phone from the QR code on the desktop door scanner. No login: the pairing token in the URL lets this
 * page validate tickets as the staff member who created it, and the desktop shows every result.
 */
export function RemoteScanner() {
  const token = useSearchParams().get("t") ?? "";
  const path = `/scanner/remote/${encodeURIComponent(token)}`;
  const [link, setLink] = useState<"checking" | "ok" | "dead">("checking");
  const [checker, setChecker] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const busyRef = useRef(false);

  // Heartbeat: tells the desktop the phone is here, and notices when the desktop disconnects.
  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLink("dead");
      return;
    }
    let alive = true;
    const ping = () =>
      apiGet<{ checker: string | null }>(path)
        .then((r) => {
          if (!alive) return;
          setLink("ok");
          setChecker(r.data.checker);
        })
        .catch((e) => alive && e instanceof ApiError && e.status === 404 && setLink("dead"));
    void ping();
    const timer = setInterval(ping, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, token]);

  const onCode = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      try {
        const r = await apiPost<ScanResult>(`${path}/scan`, scanInput(code));
        setResult(r.data);
        setCount((c) => c + 1);
        navigator.vibrate?.(r.data.result === "valid" ? 80 : [60, 60, 60]);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setLink("dead");
        setError(e instanceof ApiError ? (e.status === 429 ? "Scanning too fast. Wait a moment." : e.message) : "No connection.");
      } finally {
        busyRef.current = false;
      }
    },
    [path],
  );

  const { camera, start, stop, videoRef, canvasRef } = useQrCamera((c) => void onCode(c));
  useEffect(() => {
    if (link === "dead") stop();
  }, [link, stop]);

  const ok = result?.result === "valid";

  if (link === "dead") {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-xs space-y-3">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="text-lg font-bold text-foreground">Link expired</h1>
          <p className="text-sm text-muted">This phone link is no longer active. On the door scanner, choose &quot;Use phone as camera&quot; again and scan the new code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-background p-4">
      <header className="flex items-center gap-2 text-sm">
        <Smartphone className="size-5 text-accent" aria-hidden />
        <span className="font-bold text-foreground">Phone scanner</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <span className={cn("size-2 rounded-full", link === "ok" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          {link === "ok" ? `Linked${checker ? ` · ${checker}` : ""}` : "Connecting…"}
        </span>
      </header>

      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted className={cn("aspect-[3/4] w-full object-cover", camera !== "on" && "hidden")} aria-label="Camera preview" />
        <canvas ref={canvasRef} className="hidden" />
        {camera === "on" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-56 rounded-3xl border-2 border-accent/80 shadow-[0_0_30px_rgba(233,111,37,0.35)]" />
          </div>
        )}
        {camera !== "on" && (
          <div className="grid aspect-[3/4] place-items-center p-6 text-center text-white/80">
            <div className="space-y-4">
              <Camera className="mx-auto size-10" />
              {camera === "insecure" && <p className="text-sm">The camera needs this page to be opened over https://.</p>}
              {camera === "denied" && <p className="text-sm">Camera permission was denied. Allow it in the browser settings, then try again.</p>}
              <Button onClick={start} disabled={camera === "starting" || link !== "ok"} size="lg">
                {camera === "starting" ? "Starting…" : "Start scanning"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        role="status"
        aria-live="assertive"
        className={cn(
          "rounded-2xl border-2 p-4",
          !result && "border-line/70 bg-elevated/70",
          result && ok && "border-emerald-500 bg-emerald-500/10",
          result && !ok && "border-rose-500 bg-rose-500/10",
        )}
      >
        {result ? (
          <div className="flex items-center gap-3">
            {ok ? <CheckCircle2 className="size-8 shrink-0 text-emerald-500" /> : <XCircle className="size-8 shrink-0 text-rose-500" />}
            <div className="min-w-0">
              <p className={cn("font-extrabold", ok ? "text-emerald-500" : "text-rose-500")}>
                {ok ? "VALID: ADMIT ONE" : result.result.replaceAll("_", " ").toUpperCase()}
              </p>
              <p className="truncate text-xs text-muted">
                {result.ticket ? `Seat ${result.ticket.seat} · ${result.ticket.movie}` : result.message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Point the camera at a ticket QR code.</p>
        )}
      </div>
      {error && <p className="text-center text-sm text-rose-500">{error}</p>}
      {count > 0 && <p className="text-center text-xs text-muted">{count} scan{count === 1 ? "" : "s"} sent to the door screen</p>}
    </div>
  );
}
