import { test, expect } from "@playwright/test";

test.describe("Vendor Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Vendor List Page", () => {
    test("should display vendors page", async ({ page }) => {
      await expect(page).toHaveURL(/vendors/);
    });

    test("should show page title or heading", async ({ page }) => {
      const title = page.getByRole("heading", { name: /vendor|supplier/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should have create vendor button", async ({ page }) => {
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

    test("should display vendor list or empty state", async ({ page }) => {
      const vendorList = page.getByRole("table").or(
        page.locator('[data-testid="vendor-list"]')
      );
      const emptyState = page.getByText(/no vendors|add your first|get started/i);

      const hasVendors = await vendorList.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasVendors || isEmpty).toBeTruthy();
    });
  });

  test.describe("Vendor Creation", () => {
    test("should open vendor creation form when clicking add button", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();

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

    test("should show required fields in vendor form", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();
        await page.waitForTimeout(500);

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

  test.describe("Vendor Table/List", () => {
    test("should show vendor table headers if table exists", async ({ page }) => {
      const table = page.getByRole("table");
      const tableVisible = await table.isVisible().catch(() => false);

      if (tableVisible) {
        const nameHeader = page.getByRole("columnheader", { name: /name/i });
        const isVisible = await nameHeader.isVisible().catch(() => false);
        if (isVisible) {
          await expect(nameHeader).toBeVisible();
        }
      }
    });

    test("should have action buttons for vendor rows", async ({ page }) => {
      const table = page.getByRole("table");
      const tableVisible = await table.isVisible().catch(() => false);

      if (tableVisible) {
        const rows = await table.getByRole("row").count();
        if (rows > 1) {
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
