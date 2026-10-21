import { siteConfig } from "@/config/site";

export function formatPrice(amount: number) {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency,
  }).format(amount);
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

export function addDays(offset: number, from: Date = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}

/** Local-date ISO string (YYYY-MM-DD) without timezone shifts. */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(siteConfig.locale, opts).format(d);
}

export function formatOffsetDate(offset: number, opts?: Intl.DateTimeFormatOptions) {
  return formatDate(addDays(offset), opts);
}

export function formatISODate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const [y, m, d] = iso.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), opts ?? { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(siteConfig.locale, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
}

export function releaseLabel(offsetDays: number) {
  if (offsetDays <= 0) return "Now Showing";
  return `Opens ${formatOffsetDate(offsetDays, { day: "numeric", month: "short" })}`;
}
