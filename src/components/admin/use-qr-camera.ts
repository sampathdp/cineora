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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

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
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      setCamera("on");
    } catch {
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

  return { camera, start, stop, videoRef, canvasRef };
}
