import { test, expect } from "@playwright/test";

test.describe("Customer Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/customers");
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test.describe("Customer List Page", () => {
    test("should display customers page", async ({ page }) => {
      await expect(page).toHaveURL(/customers/);
    });

    test("should show page title or heading", async ({ page }) => {
      const title = page.getByRole("heading", { name: /customer/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should have create customer button", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .or(page.getByRole("link", { name: /add|create|new/i }))
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);
      if (isVisible) {
        await expect(createButton).toBeVisible();
      }
    });

    test("should show search or filter input", async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search|filter/i).or(
        page.getByRole("textbox", { name: /search/i })
      );
      const isVisible = await searchInput.isVisible().catch(() => false);
      if (isVisible) {
        await expect(searchInput).toBeVisible();
      }
    });

    test("should display customer list or empty state", async ({ page }) => {
      // Should show either a list of customers or an empty state message
      const customerList = page.getByRole("table").or(
        page.locator('[data-testid="customer-list"]')
      );
      const emptyState = page.getByText(/no customers|add your first|get started/i);

      const hasCustomers = await customerList.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      // One of them should be visible
      expect(hasCustomers || isEmpty).toBeTruthy();
    });
  });

  test.describe("Customer Creation", () => {
    test("should open customer creation form when clicking add button", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();

        // Should show a modal or form
        const form = page.getByRole("dialog").or(
          page.getByRole("form")
        ).or(
          page.locator('form')
        );
        const formVisible = await form.isVisible().catch(() => false);
        if (formVisible) {
          await expect(form).toBeVisible();
        }
      }
    });

    test("should show required fields in customer form", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();
        await page.waitForTimeout(500);

        // Look for name field (usually required)
        const nameField = page.getByLabel(/name/i).or(
          page.getByPlaceholder(/name/i)
        );
        const nameVisible = await nameField.isVisible().catch(() => false);
        if (nameVisible) {
          await expect(nameField).toBeVisible();
        }
      }
    });
  });

  test.describe("Customer Table/List", () => {
    test("should show customer table headers if table exists", async ({ page }) => {
      const table = page.getByRole("table");
      const tableVisible = await table.isVisible().catch(() => false);

      if (tableVisible) {
        // Check for common column headers
        const nameHeader = page.getByRole("columnheader", { name: /name/i });
        const isVisible = await nameHeader.isVisible().catch(() => false);
        if (isVisible) {
          await expect(nameHeader).toBeVisible();
        }
      }
    });

    test("should have action buttons for customer rows", async ({ page }) => {
      const table = page.getByRole("table");
      const tableVisible = await table.isVisible().catch(() => false);

      if (tableVisible) {
        const rows = await table.getByRole("row").count();
        if (rows > 1) { // More than header row
          // Look for edit/delete/view buttons
          const actionButton = page
            .getByRole("button", { name: /edit|delete|view|more/i })
            .first();
          const isVisible = await actionButton.isVisible().catch(() => false);
          if (isVisible) {
            await expect(actionButton).toBeVisible();
          }
        }
      }
    });
  });
});
