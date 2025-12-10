import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate to invoices page", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page).toHaveURL(/invoices/);
  });

  test("should navigate to quotations page", async ({ page }) => {
    await page.goto("/quotations");
    await expect(page).toHaveURL(/quotations/);
  });

  test("should navigate to customers page", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/customers/);
  });

  test("should navigate to vendors page", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page).toHaveURL(/vendors/);
  });

  test("should navigate to vault page", async ({ page }) => {
    await page.goto("/vault");
    await expect(page).toHaveURL(/vault/);
  });

  test("should navigate to assets page", async ({ page }) => {
    await page.goto("/assets");
    await expect(page).toHaveURL(/assets/);
  });

  test("should navigate to dashboard page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/dashboard/);
  });

  test("should navigate to settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/settings/);
  });

  test("should navigate to statements page", async ({ page }) => {
    await page.goto("/statements");
    await expect(page).toHaveURL(/statements/);
  });

  test("should navigate to create invoice page", async ({ page }) => {
    await page.goto("/create/invoice");
    await expect(page).toHaveURL(/create\/invoice/);
  });

  test("should navigate to create quotation page", async ({ page }) => {
    await page.goto("/create/quotation");
    await expect(page).toHaveURL(/create\/quotation/);
  });

  test("should show 404 for unknown routes", async ({ page }) => {
    await page.goto("/unknown-route-that-does-not-exist");
    // Look for 404 or not found message
    const notFound = page.getByText(/not found|404|doesn't exist/i);
    await expect(notFound).toBeVisible({ timeout: 10000 });
  });
});
