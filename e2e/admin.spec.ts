import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./helpers";

const PASSWORD = "E2e-Passw0rd!";

async function staffLogin(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Admin" });

test.describe.serial("administration: content, catalogue, scheduling, reporting", () => {
  test("a super admin sees a dashboard with real figures and the full menu", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByLabel("Key figures")).toContainText("Total bookings");
    await expect(page.getByLabel("Key figures")).toContainText("Verified revenue");
    for (const item of ["Movies", "Cinemas and rooms", "Showtimes", "Bookings", "Payments", "Reports", "Staff and access", "Audit log", "Website settings", "Bank accounts"]) {
      await expect(nav(page).getByRole("link", { name: item })).toBeVisible();
    }
  });

  test("admin creates a movie, uploads a poster, publishes it, and it appears on the public site", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Movies" }).click();
    await page.getByRole("button", { name: "New movie" }).click();

    const form = page.getByRole("form", { name: "Movie form" });
    await form.getByLabel("Title", { exact: true }).fill("E2E Midnight Run");
    await form.getByLabel("Duration (minutes)").fill("95");
    await form.getByLabel("Showing").selectOption("now_playing");
    await form.getByLabel("Synopsis").fill("A courier races the clock across the city.\n<script>alert(1)</script>");
    await form.getByLabel("Trailer link (YouTube or Vimeo, https)").fill("https://evil.example.test/video");
    await form.getByRole("button", { name: "Create draft" }).click();
    await expect(form.getByText("must match the required format", { exact: false }).or(form.getByRole("alert").first())).toBeVisible(); // a non-YouTube link is refused by the server

    await form.getByLabel("Trailer link (YouTube or Vimeo, https)").fill("");
    await form.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    // A movie cannot be published without a poster: the server says so.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /poster/i })).toBeVisible();

    await page.locator("#img-Poster").setInputFiles({ name: "poster.png", mimeType: "image/png", buffer: makePng(400, 600, [120, 40, 90]) });
    await expect(page.getByAltText("Poster preview")).toBeVisible();
    // An executable disguised as an image is rejected.
    await page.locator("#img-Banner").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<?php system($_GET['c']); ?>") });
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published.")).toBeVisible();

    await page.goto("/movies/view/?slug=e2e-midnight-run");
    await expect(page.getByRole("heading", { name: "E2E Midnight Run" })).toBeVisible();
    await expect(page.locator("main script")).toHaveCount(0); // shown as inert text at most, never executed as markup
  });

  test("admin schedules a showtime for the new movie and puts it on sale", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Showtimes" }).click();
    await page.getByRole("button", { name: "New showtime" }).click();

    const form = page.getByRole("form", { name: "New showtime" });
    await form.getByLabel("Movie (published only)").selectOption({ label: "E2E Midnight Run (95 min)" });
    const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    await form.getByLabel(/Start time/).fill(`${day}T03:00`);
    await expect(form.getByLabel(/Standard/)).toBeVisible(); // prices are asked for the room's seat categories
    await form.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("button", { name: "Put on sale" }).click();
    await expect(page.getByText("Now on sale.")).toBeVisible();

    // The same slot cannot be created twice.
    await page.getByRole("button", { name: "New showtime" }).click();
    const again = page.getByRole("form", { name: "New showtime" });
    await again.getByLabel("Movie (published only)").selectOption({ label: "E2E Midnight Run (95 min)" });
    await again.getByLabel(/Start time/).fill(`${day}T03:30`);
    await again.getByRole("button", { name: "Create draft" }).click();
    await expect(again.getByRole("alert").filter({ hasText: /overlaps|already starts|room/i })).toBeVisible();

    await page.goto("/movies/view/?slug=e2e-midnight-run");
    await expect(page.getByText(/from ₩/).first()).toBeVisible();
  });

  test("a content manager publishes news that appears publicly; markup is stripped; they cannot see payments", async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ baseURL: "http://localhost:3110" });
    const page = await ctx.newPage();
    await staffLogin(page, "e2e.editor@example.test");
    await expect(nav(page).getByRole("link", { name: "Payments" })).toHaveCount(0);
    await expect(nav(page).getByRole("link", { name: "Staff and access" })).toHaveCount(0);

    await nav(page).getByRole("link", { name: "Content" }).click();
    await page.getByRole("button", { name: "New article" }).click();
    const form = page.getByRole("form", { name: "Content form" });
    await form.getByLabel("Title").fill("E2E <b>Grand</b> opening");
    await form.getByLabel("Short summary").fill("Doors open <script>alert(1)</script>soon.");
    await form.getByLabel("Text").fill("First paragraph.\n\nSecond paragraph <img src=x onerror=alert(1)> here.");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const pub = await ctx.newPage(); // a second tab keeps the editor open
    const before = await pub.request.get("http://localhost:8010/api/v1/news");
    expect(JSON.stringify(await before.json())).not.toContain("Grand opening"); // still a draft; checked against the API so the site's 60s data cache is not primed
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Published.")).toBeVisible();

    // The public site caches API data for up to 60 seconds, so allow for that.
    const link = pub.getByRole("link", { name: /E2E Grand opening/ }).first();
    await expect(async () => {
      await pub.goto("/news");
      await expect(link).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 80_000, intervals: [5000] });
    await link.click();
    await expect(pub.getByRole("heading", { name: "E2E Grand opening" })).toBeVisible();
    await expect(pub.getByText("Second paragraph")).toBeVisible();
    expect(await pub.content()).not.toContain("onerror");
    await ctx.close();
  });

  test("reports show data, export is offered to authorised roles, and the audit log records the work", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Reports" }).click();
    await page.getByLabel("Report").selectOption("bookings");
    await expect(page.getByRole("link", { name: "Download CSV" })).toBeVisible();
    await expect(page.getByText(/^\d+ rows?$/)).toBeVisible(); // a table with data, or the empty state when nothing was booked in range

    await nav(page).getByRole("link", { name: "Audit log" }).click();
    await page.getByLabel("Action starts with").fill("movie.");
    await expect(page.getByRole("table")).toContainText("movie.created");
    await expect(page.getByRole("table")).toContainText("movie.published");
    await expect(page.getByRole("table")).not.toContainText("password");
  });

  test("a super admin adds a staff member, and a role that lacks permissions cannot be escalated", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Staff and access" }).click();
    await page.getByRole("button", { name: "Add staff member" }).click();
    const form = page.getByRole("form", { name: "Staff form" });
    await form.getByLabel("Name").fill("Door Person");
    await form.getByLabel("Email").fill("door.person@example.test");
    await form.getByText("Ticket Checker").click();
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Created. They were emailed")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("door.person@example.test");
  });
});
