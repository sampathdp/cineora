"use client";

import { useEffect, useRef } from "react";

/**
 * Max gap between keystrokes for them to count as one scanner burst. Bluetooth HID adds
 * latency/jitter, so this is looser than a wired scanner needs; humans are still slower.
 */
const MAX_GAP_MS = 100;
/** If the scanner sends no Enter/Tab suffix, flush the burst after this much silence. */
const IDLE_FLUSH_MS = 200;
const MIN_LENGTH = 4;
/** Without a suffix key, require a longer burst so fast human typing can't trigger a scan. */
const MIN_LENGTH_NO_SUFFIX = 10;

function isEditable(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/**
 * Listens for USB/Bluetooth barcode scanners in keyboard (HID) mode, e.g. Newland HR2180-BT.
 * They "type" the code very fast, usually ending with Enter; we collect that burst page-wide so
 * scanning works without focusing an input. Keystrokes inside form fields are left alone.
 */
export function useHidScanner(onScan: (code: string) => void) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let buffer = "";
    let last = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;

    function emit(min: number) {
      clearTimeout(idle);
      const code = buffer;
      buffer = "";
      if (code.length >= min) onScanRef.current(code);
      return code.length >= min;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      const fast = now - last <= MAX_GAP_MS;

      if (e.key === "Enter" || e.key === "Tab") {
        if (fast && emit(MIN_LENGTH)) e.preventDefault();
        else buffer = "";
        return;
      }
      if (e.key.length !== 1) return; // Shift etc.

      buffer = fast ? buffer + e.key : e.key;
      last = now;
      clearTimeout(idle);
      idle = setTimeout(() => emit(MIN_LENGTH_NO_SUFFIX), IDLE_FLUSH_MS);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
