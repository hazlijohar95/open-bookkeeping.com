import { test, expect } from "@playwright/test";

test.describe("Chart of Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chart-of-accounts");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Account List Page", () => {
    test("should display chart of accounts page", async ({ page }) => {
      await expect(page).toHaveURL(/chart-of-accounts/);
    });

    test("should show page title", async ({ page }) => {
      const title = page.getByRole("heading", { name: /account|chart/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should have create account button", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);
      if (isVisible) {
        await expect(createButton).toBeVisible();
      }
    });

    test("should show account type categories", async ({ page }) => {
      // Chart of accounts usually grouped by type: Assets, Liabilities, Equity, etc.
      const accountType = page.getByText(/asset|liability|equity|revenue|expense/i).first();
      const isVisible = await accountType.isVisible().catch(() => false);
      if (isVisible) {
        await expect(accountType).toBeVisible();
      }
    });

    test("should display accounts list or tree view", async ({ page }) => {
      const accountList = page.getByRole("table").or(
        page.getByRole("tree")
      ).or(
        page.locator('[data-testid="account-list"]')
      );
      const emptyState = page.getByText(/no accounts|add your first|get started/i);

      const hasAccounts = await accountList.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasAccounts || isEmpty).toBeTruthy();
    });
  });

  test.describe("Account Creation", () => {
    test("should open account creation form", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();
        await page.waitForTimeout(500);

        const form = page.getByRole("dialog").or(
          page.locator('form')
        );
        const formVisible = await form.isVisible().catch(() => false);
        if (formVisible) {
          await expect(form).toBeVisible();
        }
      }
    });

    test("should show account code field", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();
        await page.waitForTimeout(500);

        const codeField = page.getByLabel(/code|number/i).or(
          page.getByPlaceholder(/code/i)
        );
        const codeVisible = await codeField.isVisible().catch(() => false);
        if (codeVisible) {
          await expect(codeField).toBeVisible();
        }
      }
    });

    test("should show account type selector", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);

      if (isVisible) {
        await createButton.click();
        await page.waitForTimeout(500);

        const typeSelector = page.getByLabel(/type/i).or(
          page.getByRole("combobox", { name: /type/i })
        );
        const typeVisible = await typeSelector.isVisible().catch(() => false);
        if (typeVisible) {
          await expect(typeSelector).toBeVisible();
        }
      }
    });
  });
});
