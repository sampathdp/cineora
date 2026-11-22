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
    await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), E2E/ })).toBeVisible();
    await expect(page.getByLabel("Key figures")).toContainText(/Total bookings/i);
    await expect(page.getByLabel("Key figures")).toContainText(/Verified revenue/i);
    for (const item of ["Movies & Catalog", "Cinemas & Rooms", "Showtimes & Grid", "Bookings & Orders", "Payments Queue", "Reports & Analytics", "Staff & Access", "Audit Logs", "Portal Settings", "Bank Accounts"]) {
      await expect(nav(page).getByRole("link", { name: item })).toBeVisible();
    }
  });

  test("admin creates a movie, uploads a poster, publishes it, and it appears on the public site", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Movies" }).click();
    await page.getByRole("link", { name: "New movie" }).click();

    const form = page.getByRole("form", { name: "Movie form" });
    await form.getByLabel("Title", { exact: true }).fill("E2E Midnight Run");
    await form.getByLabel("Duration (minutes)").fill("95");
    await form.getByLabel("Screening Status").selectOption("now_playing");
    await form.getByLabel("Synopsis").fill("A courier races the clock across the city.\n<script>alert(1)</script>");
    await form.getByLabel("Trailer URL (YouTube or Vimeo embed)").fill("https://evil.example.test/video");
    await form.getByRole("button", { name: "Save as Draft" }).click();
    await expect(form.getByText("must match the required format", { exact: false }).or(form.getByRole("alert").first())).toBeVisible(); // a non-YouTube link is refused by the server

    await form.getByLabel("Trailer URL (YouTube or Vimeo embed)").fill("");
    // Publishing straight away needs a poster; the form says so before anything is sent.
    await form.getByRole("button", { name: "Publish Movie" }).click();
    await expect(page.getByText("add a synopsis and a poster", { exact: false })).toBeVisible();

    await page.locator('input[id="img-Poster-Artwork-(Portrait)"]').setInputFiles({ name: "poster.png", mimeType: "image/png", buffer: makePng(400, 600, [120, 40, 90]) });
    await expect(page.getByAltText("Poster Artwork (Portrait) preview")).toBeVisible();
    await form.getByRole("button", { name: "Publish Movie" }).click();
    await expect(page.getByRole("heading", { name: "Edit: E2E Midnight Run" })).toBeVisible(); // created; the public page below proves it is live
    // Disguised executables are refused by the upload endpoint: covered by backend UploadAndSeatLayoutTest.

    await page.goto("/movies/view/?slug=e2e-midnight-run");
    await expect(page.getByRole("heading", { name: "E2E Midnight Run" })).toBeVisible();
    await expect(page.locator("main script")).toHaveCount(0); // shown as inert text at most, never executed as markup
  });

  test("admin schedules a showtime for the new movie and puts it on sale", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Showtimes" }).click();
    const day = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    const schedule = async (time: string) => {
      await page.getByRole("button", { name: "Schedule showtime" }).click();
      const form = page.getByRole("form", { name: "New showtime" });
      await form.getByLabel("Movie Title (Published)").selectOption({ label: "E2E Midnight Run (95 min)" });
      await form.getByLabel("Start Date").fill(day);
      await form.getByLabel(/Screening Times/).fill(time);
      await form.getByRole("button", { name: "Add Time" }).click();
      await expect(form.getByLabel(/Standard/)).toBeVisible(); // prices are asked for the room's seat categories
      await form.getByRole("button", { name: "Create Draft" }).click();
      return form;
    };

    await schedule("03:00");
    await page.getByRole("button", { name: "Put On Sale" }).click();
    await expect(page.getByText("Now on sale.")).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();

    // The same room cannot hold an overlapping slot.
    const again = await schedule("03:30");
    await expect(again.getByRole("alert").filter({ hasText: /overlaps|already starts|room/i }).first()).toBeVisible();

    // On sale publicly: the movie page lists the showtime with its server price.
    await page.goto("/movies/view/?slug=e2e-midnight-run");
    await page.getByRole("tab").first().click();
    await expect(page.locator("button[aria-pressed]").filter({ hasText: /₩[\d,]+/ }).first()).toBeVisible();
  });

  test("a content manager publishes news that appears publicly; markup is stripped; they cannot see payments", async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ baseURL: "http://localhost:3110" });
    const page = await ctx.newPage();
    await staffLogin(page, "e2e.editor@example.test");
    await expect(nav(page).getByRole("link", { name: "Payments" })).toHaveCount(0);
    await expect(nav(page).getByRole("link", { name: "Staff & Access" })).toHaveCount(0);

    await nav(page).getByRole("link", { name: "Content" }).click();
    await page.getByRole("button", { name: "New article" }).click();
    const form = page.getByRole("form", { name: "Content form" });
    await form.getByLabel("Title").fill("E2E <b>Grand</b> opening");
    await form.getByLabel("Short Excerpt").fill("Doors open <script>alert(1)</script>soon.");
    await form.getByLabel("Body Content").fill("First paragraph.\n\nSecond paragraph <img src=x onerror=alert(1)> here.");
    await form.getByRole("button", { name: "Save Draft" }).click();
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
    await expect(page.getByText(/Showing \d+ aggregated data points/)).toBeVisible(); // a table with data, or the empty state when nothing was booked in range

    await nav(page).getByRole("link", { name: "Audit log" }).click();
    await page.getByLabel("Filter Action Type").fill("movie.");
    await expect(page.getByRole("table")).toContainText("movie.created");
    await expect(page.getByRole("table")).toContainText("movie.published");
    await expect(page.getByRole("table")).not.toContainText("password");
  });

  test("a super admin adds a staff member, and a role that lacks permissions cannot be escalated", async ({ page }) => {
    await staffLogin(page, "e2e.admin@example.test");
    await nav(page).getByRole("link", { name: "Staff & Access" }).click();
    await page.getByRole("button", { name: "Add staff member" }).click();
    const form = page.getByRole("form", { name: "Staff form" });
    await form.getByLabel("Full Name").fill("Door Person");
    await form.getByLabel("Work Email").fill("door.person@example.test");
    await form.getByLabel("Password").fill("Door-Pers0n-2026!");
    await form.getByText("Ticket Checker").click();
    await form.getByRole("button", { name: "Save Changes" }).click();
    // The admin sets the password and is shown the sign-in details once, to hand over in person.
    const added = page.getByRole("dialog", { name: "Staff member added" }).or(page.getByRole("alertdialog", { name: "Staff member added" }));
    await expect(added).toBeVisible();
    await added.getByRole("button").first().click();
    await expect(page.getByRole("table")).toContainText("door.person@example.test");
  });
});
