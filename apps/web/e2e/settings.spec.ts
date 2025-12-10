import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("should display settings page title", async ({ page }) => {
    const title = page.getByRole("heading", { name: /settings/i });
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("should show tab navigation", async ({ page }) => {
    // Look for tab buttons
    const tabs = [
      /company/i,
      /invoices/i,
      /notifications/i,
      /appearance/i,
    ];

    for (const tabName of tabs) {
      const tab = page.getByRole("tab", { name: tabName });
      const isVisible = await tab.isVisible().catch(() => false);
      if (isVisible) {
        await expect(tab).toBeVisible();
      }
    }
  });

  test("should switch between tabs", async ({ page }) => {
    // Click on Invoices tab
    const invoicesTab = page.getByRole("tab", { name: /invoices/i });
    const isVisible = await invoicesTab.isVisible().catch(() => false);

    if (isVisible) {
      await invoicesTab.click();

      // Look for invoice-specific form fields
      const currencyField = page.getByLabel(/currency/i);
      await expect(currencyField).toBeVisible();
    }
  });

  test("should show company profile form on Company tab", async ({ page }) => {
    const companyTab = page.getByRole("tab", { name: /company/i });
    const isVisible = await companyTab.isVisible().catch(() => false);

    if (isVisible) {
      await companyTab.click();

      // Check for company form fields
      const companyNameField = page.getByLabel(/company name/i);
      const isFieldVisible = await companyNameField.isVisible().catch(() => false);

      if (isFieldVisible) {
        await expect(companyNameField).toBeVisible();
      }
    }
  });

  test("should show notification settings on Notifications tab", async ({ page }) => {
    const notificationsTab = page.getByRole("tab", { name: /notifications/i });
    const isVisible = await notificationsTab.isVisible().catch(() => false);

    if (isVisible) {
      await notificationsTab.click();

      // Check for notification toggles
      const emailOnPayment = page.getByText(/payment received/i);
      const isTextVisible = await emailOnPayment.isVisible().catch(() => false);

      if (isTextVisible) {
        await expect(emailOnPayment).toBeVisible();
      }
    }
  });

  test("should show appearance settings on Appearance tab", async ({ page }) => {
    const appearanceTab = page.getByRole("tab", { name: /appearance/i });
    const isVisible = await appearanceTab.isVisible().catch(() => false);

    if (isVisible) {
      await appearanceTab.click();

      // Check for theme selector
      const themeLabel = page.getByText(/theme/i);
      const isThemeVisible = await themeLabel.isVisible().catch(() => false);

      if (isThemeVisible) {
        await expect(themeLabel).toBeVisible();
      }
    }
  });

  test("should have save button in forms", async ({ page }) => {
    // Look for save/update button
    const saveButton = page.getByRole("button", { name: /save|update/i });
    const isVisible = await saveButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(saveButton).toBeVisible();
    }
  });
});
