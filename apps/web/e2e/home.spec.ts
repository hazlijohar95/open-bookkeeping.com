import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Open Bookkeeping|Bookkeeping/i);
  });

  test("should display hero section", async ({ page }) => {
    await page.goto("/");
    // Check for main heading or hero content
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });

  test("should have navigation links", async ({ page }) => {
    await page.goto("/");
    // Check for create invoice link
    const createLink = page.getByRole("link", { name: /create/i }).first();
    await expect(createLink).toBeVisible();
  });
});
