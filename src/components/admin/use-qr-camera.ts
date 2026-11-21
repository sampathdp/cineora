"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export type CameraState = "off" | "starting" | "on" | "denied" | "insecure";

/**
 * Rear camera + QR decoding a few times per second. `onCode` fires once per code, and again for the same code only
 * after 4 s, so a ticket held in front of the lens is not re-submitted on every frame.
 */
export function useQrCamera(onCode: (code: string) => void) {
  const [camera, setCamera] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  // A page reached by in-app navigation keeps the Permissions-Policy of the first page loaded. If that policy blocks
  // the camera, Chromium (Android) refuses getUserMedia without ever showing the permission prompt. One full reload
  // gives this page its own policy; the session flag stops a reload loop if the server still blocks it.
  useEffect(() => {
    if (!cameraBlockedByPolicy()) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === location.pathname) return;
      sessionStorage.setItem(RELOAD_KEY, location.pathname);
    } catch {
      return;
    }
    location.reload();
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    // Browsers only expose cameras on https:// (or localhost).
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera("insecure");
      return;
    }
    if (cameraBlockedByPolicy()) {
      setCameraError("This page is not allowed to use the camera. Reload the page and try again.");
      setCamera("denied");
      return;
    }
    setCamera("starting");
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        // Some phones reject the facing-mode hint; any camera is better than none.
        .catch((e) => (e?.name === "OverconstrainedError" ? navigator.mediaDevices.getUserMedia({ video: true, audio: false }) : Promise.reject(e)));
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stop();
      video.setAttribute("playsinline", "true");
      video.muted = true;
      video.srcObject = stream;
      // play() can hang on some Android builds; the frames still arrive, so do not wait for it forever.
      await Promise.race([video.play().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
      setCamera("on");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? /Android/i.test(navigator.userAgent)
            ? "Camera is blocked for this site. In Chrome tap the icon left of the address bar → Permissions → Camera → Allow, then reload and try again."
            : "Camera permission was denied. Allow it for this site in the browser settings, then try again."
          : name === "NotReadableError"
            ? "The camera is in use by another app. Close it and try again."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : `Could not start the camera${e instanceof Error && e.message ? `: ${e.message}` : "."}`,
      );
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCamera("denied");
    }
  }, [stop]);

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
        onCodeRef.current(hit.data);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [camera]);

  return { camera, cameraError, start, stop, videoRef, canvasRef };
}

const RELOAD_KEY = "qr-camera-policy-reload";

/** True when the page's Permissions-Policy forbids the camera (Chromium only; other browsers report nothing). */
function cameraBlockedByPolicy(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature(f: string): boolean };
    featurePolicy?: { allowsFeature(f: string): boolean };
  };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  try {
    return policy ? !policy.allowsFeature("camera") : false;
  } catch {
    return false;
  }
}
