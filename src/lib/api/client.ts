/**
 * The single place the frontend talks to the Laravel API.
 *
 * Auth is cookie based (Laravel Sanctum SPA mode): the browser keeps an HttpOnly session cookie that
 * scripts cannot read. Only the non-secret XSRF-TOKEN cookie is read here, to echo it back as a header.
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export const AUTH_EXPIRED_EVENT = "cineora:auth-expired";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork() {
    return this.status === 0;
  }

  /** First validation message for a field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Sent as the Idempotency-Key header (booking creation). */
  idempotencyKey?: string;
  /** Do not announce session expiry on 401 (used for the initial "who am I" probe). */
  silent401?: boolean;
}

const MUTATING: ReadonlySet<Method> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

let csrfInFlight: Promise<void> | null = null;

/** Asks Laravel to set the XSRF-TOKEN cookie. De-duplicated so parallel mutations share one call. */
export function initCsrf(): Promise<void> {
  csrfInFlight ??= fetch(`${API_BASE_URL}/sanctum/csrf-cookie`, { credentials: "include" })
    .then(() => undefined)
    .catch(() => {
      throw new ApiError("Could not reach the server. Check your connection and try again.", 0, "network");
    })
    .finally(() => {
      csrfInFlight = null;
    });
  return csrfInFlight;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const method = opts.method ?? "GET";
  if (MUTATING.has(method) && !readCookie("XSRF-TOKEN")) await initCsrf();

  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  // For multipart bodies the browser must set Content-Type itself (it adds the boundary).
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const xsrf = readCookie("XSRF-TOKEN");
  if (MUTATING.has(method) && xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      credentials: "include",
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0, "network");
  }

  // CSRF token missing/expired: fetch a fresh one and retry the request once.
  if (res.status === 419 && !retried) {
    await initCsrf();
    return send(path, opts, true);
  }
  return res;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const res = await send(path, opts);

  let json: Partial<ApiEnvelope<T>> & { errors?: Record<string, string[]>; code?: string } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON body (proxy error page etc.) */
  }

  if (!res.ok || json.success === false) {
    if (res.status === 401 && !opts.silent401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const fallback = res.status >= 500 ? "Something went wrong on our side. Please try again." : "The request could not be completed.";
    throw new ApiError(json.message || fallback, res.status, json.code, json.errors ?? {});
  }

  return json as ApiEnvelope<T>;
}

/** Downloads a protected file (e.g. a payment proof) with the session cookie and returns it as a Blob. */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const res = await send(path, { method: "GET", signal });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(res.status === 404 ? "File not found." : "Could not load the file.", res.status);
  }
  return res.blob();
}

export const apiGet = <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) => api<T>(path, { ...opts, method: "GET" });
export const apiPost = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
  api<T>(path, { ...opts, method: "POST", body: body ?? {} });
export const apiPatch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ?? {} });
export const apiDelete = <T>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });
