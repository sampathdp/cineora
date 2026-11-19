import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2e-Passw0rd!";

async function login(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Opens the first movie with showtimes, picks the first date and time, returns once the seat map is visible. */
async function openSeatMap(page: Page) {
  await page.goto("/movies/ashes-of-the-lantern");
  await page.getByRole("tab").first().click();
  await page.locator("ul button[aria-pressed]").first().click();
  await expect(page.getByRole("group", { name: "Seats" })).toBeVisible();
}

const seat = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^Seat ${label},`) });

test.describe.serial("customer booking journey (real browser, real API, real MySQL)", () => {
  test("browse, pick seats, sign in, reserve, see the hold", async ({ page }) => {
    await openSeatMap(page);
    await expect(page.getByText("₩12,000").first()).toBeVisible();

    await seat(page, "D5").click();
    await seat(page, "D6").click();
    await expect(page.getByText("Quantity").first()).toBeVisible();
    await page.getByRole("button", { name: "Continue to checkout" }).first().click();

    // Anonymous visitors are asked to sign in; the selection is remembered.
    await expect(page.getByRole("heading", { name: "Sign in to reserve" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email", { exact: true }).fill("e2e.one@example.test");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Reserve your seats" })).toBeVisible();
    await expect(page.getByText("D5").first()).toBeVisible();
    const reserve = page.getByRole("button", { name: "Reserve seats" });
    await expect(reserve).toBeDisabled(); // terms not accepted yet
    await page.getByLabel(/I agree to the/).check();
    await reserve.click();

    // The booking exists on the server with a hold.
    await expect(page).toHaveURL(/\/account\/bookings\/[0-9A-Z]{26}$/);
    await expect(page.getByText(/^CIN-[A-HJ-NP-Z2-9]{8}$/).first()).toBeVisible();
    await expect(page.getByText("Awaiting payment").first()).toBeVisible();
    await expect(page.getByRole("timer")).toContainText("Seats held for");

    await page.goto("/account/bookings");
    await expect(page.getByText("Awaiting payment")).toBeVisible();
  });

  test("a second customer sees those seats as taken", async ({ page }) => {
    await login(page, "e2e.two@example.test", "/account");
    await expect(page).toHaveURL(/\/account$/);
    await openSeatMap(page);
    await expect(seat(page, "D5")).toBeDisabled();
    await expect(seat(page, "D6")).toBeDisabled();
    await expect(seat(page, "D7")).toBeEnabled();
  });

  test("someone else's booking is not reachable by its URL", async ({ page, browser }) => {
    await login(page, "e2e.one@example.test", "/account/bookings");
    await page.getByRole("link", { name: /CIN-/ }).first().click();
    await expect(page).toHaveURL(/\/account\/bookings\/[0-9A-Z]{26}$/);
    const url = page.url();

    const other = await browser.newContext({ baseURL: "http://localhost:3110" });
    const p2 = await other.newPage();
    await login(p2, "e2e.two@example.test");
    await expect(p2).toHaveURL(/\/account$/);
    await p2.goto(url);
    await expect(p2.getByText("We could not find that booking.")).toBeVisible();
    await other.close();
  });

  test("the owner cancels and the seats go back on sale", async ({ page }) => {
    await login(page, "e2e.one@example.test", "/account/bookings");
    await page.getByRole("link", { name: /CIN-/ }).first().click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText("These seats were released.")).toBeVisible();

    await openSeatMap(page);
    await expect(seat(page, "D5")).toBeEnabled();
  });
});
