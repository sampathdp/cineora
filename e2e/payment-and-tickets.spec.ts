import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./helpers";

const PASSWORD = "E2e-Passw0rd!";
const SITE = "http://localhost:3110";

async function login(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login")); // the session cookie is set once we leave the form
}

async function staffLogin(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}

const seat = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^Seat ${label},`) });

/** Shared between the steps of the story below. */
const story: { bookingUrl?: string; reference?: string; ticketRefs: string[]; qrs: string[] } = { ticketRefs: [], qrs: [] };

test.describe.serial("pay by bank transfer, get verified, receive tickets, get scanned at the door", () => {
  test("customer reserves seats and uploads a transfer proof", async ({ page }) => {
    await login(page, "e2e.three@example.test");
    await page.goto("/movies/view/?slug=ashes-of-the-lantern");
    await page.getByRole("tab").first().click();
    await page.locator("button[aria-pressed]").filter({ hasText: /seats/ }).first().click(); // showtime card
    await expect(page.getByRole("group", { name: "Seats" })).toBeVisible();
    await seat(page, "F1").click();
    await seat(page, "F2").click();
    await page.getByRole("button", { name: "Continue to checkout" }).first().click();
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Reserve seats" }).click();
    await expect(page).toHaveURL(/\/account\/bookings\/view\/\?id=[0-9A-Z]{26}$/);
    story.bookingUrl = page.url();
    story.reference = (await page.getByText(/^CIN-[A-HJ-NP-Z2-9]{8}$/).first().textContent()) ?? undefined;

    // Bank details and the transfer memo are shown.
    await expect(page.getByText("E2E Test Bank")).toBeVisible();
    await expect(page.getByText("123-456-789012")).toBeVisible();
    await expect(page.getByLabel("Copy Transfer memo (important)")).toBeVisible();

    // Client-side checks: wrong file type is refused before any upload.
    await page.locator("#proof-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("Choose a JPEG, PNG, WebP or PDF file.")).toBeVisible();

    await page.locator("#proof-file").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: makePng(320, 200, [20, 90, 140]) });
    await page.getByRole("button", { name: "Send proof" }).click();
    await expect(page.getByText("A member of staff is checking it", { exact: false })).toBeVisible();
    await expect(page.getByText("Payment under review").first()).toBeVisible();
  });

  test("a payment verifier reviews the proof and verifies it", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: SITE });
    const page = await ctx.newPage();
    await staffLogin(page, "e2e.verifier@example.test");

    // Role-aware navigation: a verifier sees payments but not the scanner.
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Payments" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ticket Scanner" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Bank Accounts" })).toHaveCount(0);

    await nav.getByRole("link", { name: "Payments" }).click();
    await page.getByRole("row", { name: new RegExp(story.reference!) }).getByRole("button", { name: "Review" }).click();
    await expect(page.getByRole("heading", { name: story.reference! })).toBeVisible();
    await expect(page.getByAltText("Customer's transfer slip")).toBeVisible(); // protected file shown through the API
    await expect(page.getByText("E2E Three")).toHaveCount(0); // a verifier is not shown the customer's identity

    await page.getByRole("button", { name: "Verify & issue tickets" }).click();
    await page.getByRole("dialog", { name: "Verify this transfer?" }).getByRole("button", { name: "Verify & issue tickets" }).click();
    await expect(page.getByText(/payment verified\. Tickets issued\./)).toBeVisible();
    await ctx.close();
  });

  test("the customer now has tickets with QR codes", async ({ page }) => {
    await login(page, "e2e.three@example.test");
    await page.goto(story.bookingUrl!);
    await expect(page.getByText("Confirmed").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your tickets" })).toBeVisible();
    await expect(page.getByAltText(/QR code for seat F1/)).toBeVisible();
    await expect(page.getByAltText(/QR code for seat F2/)).toBeVisible();

    // Collect the QR contents and references exactly as the owner's browser receives them.
    const tickets = await page.evaluate(async () => {
      const r = await fetch("http://localhost:8010/api/v1/tickets", { credentials: "include", headers: { Accept: "application/json" } });
      return (await r.json()).data as { reference: string; qr: string; seat: string }[];
    });
    expect(tickets).toHaveLength(2);
    for (const t of tickets) expect(t.qr).toMatch(/^CINEORA1:[A-Za-z0-9_-]{43}$/);
    story.ticketRefs = tickets.map((t) => t.reference);
    story.qrs = tickets.map((t) => t.qr);

    await page.goto("/account/tickets");
    await expect(page.getByLabel(/^Ticket for seat/)).toHaveCount(2);
  });

  test("a ticket checker admits each ticket once and a repeat scan is rejected", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: SITE });
    const page = await ctx.newPage();
    await staffLogin(page, "e2e.checker@example.test");

    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Payments" })).toHaveCount(0);
    await nav.getByRole("link", { name: "Ticket Scanner" }).click();

    const entry = page.getByLabel("Ticket Reference / QR Payload (Manual)");
    const status = page.getByRole("status").filter({ hasText: /VALID|USED|INVALID|WRONG|Waiting/i });

    // Scan the QR content of the first ticket.
    await entry.fill(story.qrs[0]);
    await page.getByRole("button", { name: "Validate Code" }).click();
    await expect(status).toContainText("VALID: ADMIT ONE");
    await expect(status).not.toContainText("E2E Three"); // no customer data at the door

    // The same QR again, and the same ticket by its printed reference.
    await entry.fill(story.qrs[0]);
    await page.getByRole("button", { name: "Validate Code" }).click();
    await expect(status).toContainText("ALREADY USED");
    await entry.fill(story.ticketRefs.find((_, i) => i === 0)!);
    await page.getByRole("button", { name: "Validate Code" }).click();
    await expect(status).toContainText("ALREADY USED");

    // The second seat is a separate ticket and is admitted by reference; garbage is simply "not valid".
    await entry.fill(story.ticketRefs[1]);
    await page.getByRole("button", { name: "Validate Code" }).click();
    await expect(status).toContainText("VALID: ADMIT ONE");
    await entry.fill("CINEORA1:definitely-not-a-real-ticket-token-00000000");
    await page.getByRole("button", { name: "Validate Code" }).click();
    await expect(status).toContainText("INVALID TICKET CODE");

    await expect(page.getByLabel("Recent scans").getByText("valid", { exact: true })).toHaveCount(2);

    // The camera is never requested until the checker asks for it.
    await expect(page.getByRole("button", { name: "Activate Camera Scanner" })).toBeVisible();
    await ctx.close();
  });

  test("a customer cannot open the staff portal and staff pages reject direct API access", async ({ page }) => {
    await login(page, "e2e.one@example.test");
    await page.goto("/admin/payments");
    await expect(page).toHaveURL(/\/admin\/login/);

    const codes = await page.evaluate(async () => {
      const get = async (path: string) => (await fetch(`http://localhost:8010/api/v1${path}`, { credentials: "include", headers: { Accept: "application/json" } })).status;
      return [await get("/admin/payments"), await get("/admin/tickets/recent"), await get("/admin/bank-accounts")];
    });
    expect(codes).toEqual([403, 403, 403]);
  });
});
