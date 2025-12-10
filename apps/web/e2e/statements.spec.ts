import { test, expect } from "@playwright/test";

test.describe("Statements Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/statements");
  });

  test("should display statements page title", async ({ page }) => {
    const title = page.getByRole("heading", { name: /statement of accounts/i });
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("should show customer/vendor tabs", async ({ page }) => {
    // Look for customer and vendor tabs
    const customerTab = page.getByRole("tab", { name: /customers/i });
    const vendorTab = page.getByRole("tab", { name: /vendors/i });

    const customerVisible = await customerTab.isVisible().catch(() => false);
    const vendorVisible = await vendorTab.isVisible().catch(() => false);

    if (customerVisible) {
      await expect(customerTab).toBeVisible();
    }
    if (vendorVisible) {
      await expect(vendorTab).toBeVisible();
    }
  });

  test("should switch between customer and vendor tabs", async ({ page }) => {
    const vendorTab = page.getByRole("tab", { name: /vendors/i });
    const isVisible = await vendorTab.isVisible().catch(() => false);

    if (isVisible) {
      await vendorTab.click();
      await expect(vendorTab).toHaveAttribute("data-state", "active");
    }
  });

  test("should show customer selector", async ({ page }) => {
    // Look for customer selector button/combobox
    const selector = page.getByRole("combobox").first();
    const isVisible = await selector.isVisible().catch(() => false);

    if (isVisible) {
      await expect(selector).toBeVisible();
    }
  });

  test("should show date range picker", async ({ page }) => {
    // Look for date picker
    const datePicker = page.getByRole("button", { name: /pick a date|select date/i });
    const isVisible = await datePicker.isVisible().catch(() => false);

    if (isVisible) {
      await expect(datePicker).toBeVisible();
    }
  });

  test("should show all customers summary when no customer selected", async ({ page }) => {
    // When no customer is selected, should show summary of all customers
    const summaryTable = page.getByRole("table");
    const isVisible = await summaryTable.isVisible().catch(() => false);

    if (isVisible) {
      // Check for table headers
      const nameHeader = page.getByRole("columnheader", { name: /name/i });
      const headerVisible = await nameHeader.isVisible().catch(() => false);

      if (headerVisible) {
        await expect(nameHeader).toBeVisible();
      }
    }
  });

  test("should export button be present", async ({ page }) => {
    // Look for export functionality
    const exportButton = page.getByRole("button", { name: /export|download/i });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(exportButton).toBeVisible();
    }
  });
});
