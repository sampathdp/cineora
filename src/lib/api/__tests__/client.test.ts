import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiPost } from "../client";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = (data: unknown = null) => json(200, { success: true, message: "ok", data, meta: {} });

let cookie = "";
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookie = "";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("sends credentials and parses the envelope on GET", async () => {
    fetchMock.mockResolvedValueOnce(ok({ a: 1 }));
    const res = await api("/auth/me");
    expect(res.data).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/auth/me");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-XSRF-TOKEN"]).toBeUndefined();
  });

  it("initialises CSRF before the first mutation and echoes the decoded cookie", async () => {
    fetchMock.mockImplementationOnce(async () => {
      cookie = "XSRF-TOKEN=abc%3D%3D; other=1";
      return new Response(null, { status: 204 });
    });
    fetchMock.mockResolvedValueOnce(ok());
    await apiPost("/auth/login", { email: "a", password: "b" });

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/sanctum/csrf-cookie");
    const init = fetchMock.mock.calls[1][1];
    expect(init.headers["X-XSRF-TOKEN"]).toBe("abc==");
    expect(init.method).toBe("POST");
  });

  it("refreshes the CSRF token and retries once on 419", async () => {
    cookie = "XSRF-TOKEN=old";
    fetchMock.mockResolvedValueOnce(json(419, { success: false, message: "expired", code: "csrf_mismatch" }));
    fetchMock.mockImplementationOnce(async () => {
      cookie = "XSRF-TOKEN=fresh";
      return new Response(null, { status: 204 });
    });
    fetchMock.mockResolvedValueOnce(ok("done"));

    const res = await apiPost("/x", {});
    expect(res.data).toBe("done");
    expect(fetchMock.mock.calls[2][1].headers["X-XSRF-TOKEN"]).toBe("fresh");
  });

  it("does not retry 419 forever", async () => {
    cookie = "XSRF-TOKEN=old";
    fetchMock.mockResolvedValue(json(419, { success: false, message: "expired" }));
    await expect(apiPost("/x", {})).rejects.toMatchObject({ status: 419 });
  });

  it("maps validation errors to field messages", async () => {
    cookie = "XSRF-TOKEN=t";
    fetchMock.mockResolvedValueOnce(json(422, { success: false, message: "invalid", code: "validation_failed", errors: { email: ["bad email"] } }));
    const err = await apiPost("/x", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldError("email")).toBe("bad email");
    expect(err.fieldError("name")).toBeUndefined();
  });

  it("announces session expiry on 401 unless silenced", async () => {
    fetchMock.mockResolvedValue(json(401, { success: false, message: "Authentication required.", code: "unauthenticated" }));
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);

    await expect(api("/auth/me", { silent401: true })).rejects.toMatchObject({ status: 401 });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("reports network failures and hides server detail on 5xx", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(api("/x")).rejects.toMatchObject({ status: 0, code: "network", isNetwork: true });

    fetchMock.mockResolvedValueOnce(new Response("<html>stack trace</html>", { status: 500 }));
    const err = await api("/x").catch((e) => e);
    expect(err.status).toBe(500);
    expect(err.message).not.toContain("stack");
  });

  it("passes the idempotency key and drops empty query values", async () => {
    cookie = "XSRF-TOKEN=t";
    fetchMock.mockResolvedValueOnce(ok());
    await api("/bookings", { method: "POST", body: {}, idempotencyKey: "key-1", query: { a: "1", b: undefined, c: "" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/bookings?a=1");
    expect(init.headers["Idempotency-Key"]).toBe("key-1");
  });

  it("sends multipart bodies untouched so the browser sets the boundary", async () => {
    cookie = "XSRF-TOKEN=t";
    fetchMock.mockResolvedValueOnce(ok());
    const form = new FormData();
    form.set("proof", new Blob(["x"], { type: "image/png" }), "a.png");
    await api("/bookings/x/payment/proof", { method: "POST", body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers["X-XSRF-TOKEN"]).toBe("t");
  });

  it("downloads protected files as blobs and reports failures without leaking detail", async () => {
    const { apiBlob } = await import("../client");
    fetchMock.mockResolvedValueOnce(new Response("img", { status: 200, headers: { "Content-Type": "image/png" } }));
    expect(await apiBlob("/admin/payments/x/proofs/1")).toBeInstanceOf(Blob);
    fetchMock.mockResolvedValueOnce(new Response("<html>nope</html>", { status: 403 }));
    await expect(apiBlob("/admin/payments/x/proofs/1")).rejects.toMatchObject({ status: 403, message: "Could not load the file." });
  });
});
