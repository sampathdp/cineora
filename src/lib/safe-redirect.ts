/** Only same-site relative paths are accepted as post-login destinations (prevents open redirects). */
export function safeRedirect(target: string | null | undefined, fallback = "/account"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  try {
    const url = new URL(target, "http://placeholder.invalid");
    if (url.origin !== "http://placeholder.invalid") return fallback;
  } catch {
    return fallback;
  }
  return target;
}
