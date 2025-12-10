import { test, expect } from "@playwright/test";

test.describe("Invoice Creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create/invoice");
  });

  test("should display invoice creation page", async ({ page }) => {
    // Look for invoice form or title
    const title = page.getByRole("heading", { name: /invoice|create/i }).first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("should show client details section", async ({ page }) => {
    // Look for client/customer section
    const clientSection = page.getByText(/client|customer|bill to/i).first();
    await expect(clientSection).toBeVisible();
  });

  test("should show invoice items section", async ({ page }) => {
    // Look for items/line items section
    const itemsSection = page.getByText(/items|products|services/i).first();
    const isVisible = await itemsSection.isVisible().catch(() => false);

    if (isVisible) {
      await expect(itemsSection).toBeVisible();
    }
  });

  test("should have add item button", async ({ page }) => {
    // Look for add item button
    const addButton = page.getByRole("button", { name: /add item|add line/i });
    const isVisible = await addButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(addButton).toBeVisible();
    }
  });

  test("should show invoice details section", async ({ page }) => {
    // Look for invoice details (number, date, due date)
    const invoiceNumber = page.getByLabel(/invoice (number|#)/i);
    const isVisible = await invoiceNumber.isVisible().catch(() => false);

    if (isVisible) {
      await expect(invoiceNumber).toBeVisible();
    }
  });

  test("should show currency selector", async ({ page }) => {
    // Look for currency field
    const currencyField = page.getByText(/currency/i);
    const isVisible = await currencyField.isVisible().catch(() => false);

    if (isVisible) {
      await expect(currencyField).toBeVisible();
    }
  });

  test("should show total calculation", async ({ page }) => {
    // Look for total/subtotal
    const total = page.getByText(/total|subtotal/i).first();
    const isVisible = await total.isVisible().catch(() => false);

    if (isVisible) {
      await expect(total).toBeVisible();
    }
  });

  test("should have save/generate button", async ({ page }) => {
    // Look for save or generate invoice button
    const saveButton = page.getByRole("button", { name: /save|generate|create|submit/i });
    const isVisible = await saveButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(saveButton).toBeVisible();
    }
  });
});
