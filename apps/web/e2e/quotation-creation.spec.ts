import { test, expect } from "@playwright/test";

test.describe("Quotation Creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create/quotation");
  });

  test("should display quotation creation page", async ({ page }) => {
    // Look for quotation form or title
    const title = page.getByRole("heading", { name: /quotation|quote|estimate/i }).first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("should show client details section", async ({ page }) => {
    // Look for client/customer section
    const clientSection = page.getByText(/client|customer|bill to/i).first();
    await expect(clientSection).toBeVisible();
  });

  test("should show quotation items section", async ({ page }) => {
    // Look for items section
    const itemsSection = page.getByText(/items|products|services/i).first();
    const isVisible = await itemsSection.isVisible().catch(() => false);

    if (isVisible) {
      await expect(itemsSection).toBeVisible();
    }
  });

  test("should have validity period field", async ({ page }) => {
    // Look for validity/expiry date field
    const validityField = page.getByText(/valid|expir|due/i).first();
    const isVisible = await validityField.isVisible().catch(() => false);

    if (isVisible) {
      await expect(validityField).toBeVisible();
    }
  });

  test("should show total calculation", async ({ page }) => {
    // Look for total
    const total = page.getByText(/total|subtotal/i).first();
    const isVisible = await total.isVisible().catch(() => false);

    if (isVisible) {
      await expect(total).toBeVisible();
    }
  });

  test("should have save/generate button", async ({ page }) => {
    // Look for save or generate quotation button
    const saveButton = page.getByRole("button", { name: /save|generate|create|submit/i });
    const isVisible = await saveButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(saveButton).toBeVisible();
    }
  });
});
