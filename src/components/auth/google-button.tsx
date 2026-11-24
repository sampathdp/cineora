"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api/client";
import { FormMessage } from "./form-kit";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** "Continue with Google" button. Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset. */
export function GoogleButton({ next }: { next: string }) {
  const { googleLogin } = useAuth();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let live = true;
    loadScript()
      .then(() => {
        const g = window.google?.accounts.id;
        if (!live || !g || !ref.current) return;
        g.initialize({
          client_id: CLIENT_ID,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            setError(null);
            try {
              await googleLogin(credential);
              router.replace(next);
            } catch (e) {
              setError(e instanceof ApiError ? (e.errors.credential?.[0] ?? e.message) : "Google sign-in failed. Please try again.");
            }
          },
        });
        g.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: ref.current.offsetWidth || 320 });
      })
      .catch(() => live && setError("Google sign-in is unavailable right now."));
    return () => {
      live = false;
    };
  }, [googleLogin, router, next]);

  if (!CLIENT_ID) return null;

  return (
    <div className="mb-5 flex flex-col gap-3">
      <FormMessage>{error}</FormMessage>
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
