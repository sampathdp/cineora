"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { adminApi, type ScanResult } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatTime, zonedParts } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { FormMessage, inputClass } from "@/components/auth/form-kit";
import { PageTitle, Pill } from "./kit";
import { cn } from "@/lib/utils";

const TITLE: Record<ScanResult["result"], string> = {
  valid: "VALID: ADMIT ONE",
  already_used: "ALREADY USED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
  wrong_showtime: "WRONG SHOWTIME / NOT OPEN",
  invalid: "NOT VALID",
  void: "NOT VALID (ON HOLD)",
};

/**
 * Door scanner. The camera is only requested when the checker presses "Start camera". Manual entry of the ticket
 * reference works without any camera. Every decision is made by the server; this component only displays it.
 */
export function TicketScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState<{ outcome: string; seat: string | null; at: string | null }[]>([]);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "denied">("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

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
        setResult(await adminApi.validateTicket(input));
        loadRecent();
      } catch (e) {
        setResult(null);
        setError(e instanceof ApiError ? (e.status === 429 ? "Scanning too fast. Wait a moment." : e.message) : "Could not reach the server.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [loadRecent],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stopCamera();
      video.srcObject = stream;
      await video.play();
      setCamera("on");
    } catch {
      setCamera("denied");
    }
  }

  // Decode a frame a few times per second while the camera is on.
  useEffect(() => {
    if (camera !== "on") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (hit?.data && !(hit.data === lastRef.current.code && Date.now() - lastRef.current.at < 4000)) {
        lastRef.current = { code: hit.data, at: Date.now() };
        void validate({ code: hit.data });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [camera, validate]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    // A 26-character ULID is a printed ticket reference; anything else is treated as raw QR content.
    void validate(/^[0-9A-Za-z]{26}$/.test(v) ? { reference: v } : { code: v });
    setManual("");
  }

  const ok = result?.result === "valid";
  return (
    <section>
      <PageTitle
        title="Ticket Validator & Door Scanner"
        eyebrow="Admissions & Door Gate"
        hint="Scan the QR code on the customer's phone or physical ticket slip. Every scan decision is verified cryptographically by the server."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-black shadow-lg">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn("aspect-video w-full object-cover", camera !== "on" && "hidden")}
              aria-label="Camera preview"
            />
            {/* Viewfinder overlay reticle when camera is active */}
            {camera === "on" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative size-48 sm:size-56 rounded-2xl border-2 border-accent/70 shadow-[0_0_15px_rgba(233,111,37,0.3)]">
                  <div className="absolute -top-1 -left-1 size-4 border-t-2 border-l-2 border-accent" />
                  <div className="absolute -top-1 -right-1 size-4 border-t-2 border-r-2 border-accent" />
                  <div className="absolute -bottom-1 -left-1 size-4 border-b-2 border-l-2 border-accent" />
                  <div className="absolute -bottom-1 -right-1 size-4 border-b-2 border-r-2 border-accent" />
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-accent/40 animate-pulse" />
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            {camera !== "on" ? (
              <div className="grid aspect-video place-items-center p-6 text-center text-sm text-white/60">
                <div className="flex flex-col items-center gap-2">
                  <Camera className="size-8 text-white/40" />
                  <p>{camera === "starting" ? "Initializing camera device…" : "Camera is currently inactive"}</p>
                  <p className="text-xs text-white/40">Click &apos;Start camera&apos; or type the printed ticket code below</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {camera === "on" ? (
              <Button variant="secondary" onClick={stopCamera}><CameraOff className="size-4" aria-hidden /> Stop camera</Button>
            ) : (
              <Button onClick={startCamera} disabled={camera === "starting"}><Camera className="size-4" aria-hidden /> Start camera</Button>
            )}
          </div>
          {camera === "denied" ? <FormMessage>Camera access was blocked or is unavailable. Use manual entry below.</FormMessage> : null}

          <form onSubmit={submitManual} className="flex flex-wrap items-end gap-3" aria-label="Manual ticket entry">
            <div className="min-w-0 flex-1">
              <label htmlFor="manual" className="mb-1.5 block text-sm font-semibold">Ticket reference (manual entry)</label>
              <input id="manual" value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" spellCheck={false} maxLength={200} className={inputClass(false)} placeholder="26-character reference printed on the ticket" />
            </div>
            <Button type="submit" disabled={busy || !manual.trim()}>Check</Button>
          </form>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </div>

        <div className="grid content-start gap-4">
          <div
            role="status"
            aria-live="assertive"
            className={cn("rounded-card border-2 p-5", !result && "border-line bg-elevated", result && ok && "border-emerald-500 bg-emerald-500/15", result && !ok && "border-red-500 bg-red-500/10")}
          >
            {result ? (
              <>
                <p className="flex items-center gap-2 text-xl font-bold">
                  {ok ? <CheckCircle2 className="size-6 text-emerald-500" aria-hidden /> : <XCircle className="size-6 text-red-500" aria-hidden />}
                  {TITLE[result.result]}
                </p>
                <p className="mt-1 text-sm">{result.message}</p>
                {result.ticket ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-muted">Seat</dt><dd className="font-semibold">{result.ticket.seat} · {result.ticket.category}</dd></div>
                    <div><dt className="text-muted">Room</dt><dd className="font-semibold">{result.ticket.room}</dd></div>
                    <div className="col-span-2"><dt className="text-muted">Movie</dt><dd className="font-semibold">{result.ticket.movie}</dd></div>
                    <div><dt className="text-muted">Starts</dt><dd className="font-semibold">{formatTime(zonedParts(result.ticket.starts_at, "Asia/Seoul").time)}</dd></div>
                    {result.ticket.checked_in_at ? <div><dt className="text-muted">Used at</dt><dd className="font-semibold">{formatTime(zonedParts(result.ticket.checked_in_at, "Asia/Seoul").time)}</dd></div> : null}
                  </dl>
                ) : null}
              </>
            ) : (
              <p className="text-muted">{busy ? "Checking…" : "Waiting for a ticket."}</p>
            )}
          </div>
          <div>
            <h2 className="font-semibold">Your recent scans</h2>
            <ul className="mt-2 divide-y divide-line text-sm" aria-label="Recent scans">
              {recent.slice(0, 8).map((r, i) => (
                <li key={i} className="flex justify-between py-1.5"><span>{r.seat ?? "—"}</span><span className={r.outcome === "valid" ? "text-emerald-500" : "text-red-500"}>{r.outcome.replaceAll("_", " ")}</span></li>
              ))}
              {recent.length === 0 ? <li className="py-1.5 text-muted">No scans yet.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
