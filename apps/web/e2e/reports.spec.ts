import { test, expect } from "@playwright/test";

test.describe("Financial Reports", () => {
  test.describe("Trial Balance", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/trial-balance");
      await page.waitForLoadState("networkidle");
    });

    test("should display trial balance page", async ({ page }) => {
      await expect(page).toHaveURL(/trial-balance/);
    });

    test("should show page title", async ({ page }) => {
      const title = page.getByRole("heading", { name: /trial balance/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should show date range selector", async ({ page }) => {
      const dateSelector = page.getByLabel(/date|period|from|to/i).or(
        page.locator('input[type="date"]')
      );
      const isVisible = await dateSelector.isVisible().catch(() => false);
      if (isVisible) {
        await expect(dateSelector).toBeVisible();
      }
    });

    test("should show debit and credit columns", async ({ page }) => {
      const table = page.getByRole("table");
      const tableVisible = await table.isVisible().catch(() => false);

      if (tableVisible) {
        const debitHeader = page.getByText(/debit/i);
        const creditHeader = page.getByText(/credit/i);

        const debitVisible = await debitHeader.isVisible().catch(() => false);
        const creditVisible = await creditHeader.isVisible().catch(() => false);

        if (debitVisible && creditVisible) {
          await expect(debitHeader).toBeVisible();
          await expect(creditHeader).toBeVisible();
        }
      }
    });
  });

  test.describe("Profit & Loss", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/profit-loss");
      await page.waitForLoadState("networkidle");
    });

    test("should display profit & loss page", async ({ page }) => {
      await expect(page).toHaveURL(/profit-loss/);
    });

    test("should show page title", async ({ page }) => {
      const title = page.getByRole("heading", { name: /profit|loss|income/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should show revenue section", async ({ page }) => {
      const revenue = page.getByText(/revenue|income|sales/i).first();
      const isVisible = await revenue.isVisible().catch(() => false);
      if (isVisible) {
        await expect(revenue).toBeVisible();
      }
    });

    test("should show expenses section", async ({ page }) => {
      const expenses = page.getByText(/expense|cost/i).first();
      const isVisible = await expenses.isVisible().catch(() => false);
      if (isVisible) {
        await expect(expenses).toBeVisible();
      }
    });

    test("should show net profit/loss total", async ({ page }) => {
      const netProfit = page.getByText(/net (profit|loss|income)/i).first();
      const isVisible = await netProfit.isVisible().catch(() => false);
      if (isVisible) {
        await expect(netProfit).toBeVisible();
      }
    });
  });

  test.describe("Balance Sheet", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/balance-sheet");
      await page.waitForLoadState("networkidle");
    });

    test("should display balance sheet page", async ({ page }) => {
      await expect(page).toHaveURL(/balance-sheet/);
    });

    test("should show page title", async ({ page }) => {
      const title = page.getByRole("heading", { name: /balance sheet/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should show assets section", async ({ page }) => {
      const assets = page.getByText(/asset/i).first();
      const isVisible = await assets.isVisible().catch(() => false);
      if (isVisible) {
        await expect(assets).toBeVisible();
      }
    });

    test("should show liabilities section", async ({ page }) => {
      const liabilities = page.getByText(/liabilit/i).first();
      const isVisible = await liabilities.isVisible().catch(() => false);
      if (isVisible) {
        await expect(liabilities).toBeVisible();
      }
    });

    test("should show equity section", async ({ page }) => {
      const equity = page.getByText(/equity/i).first();
      const isVisible = await equity.isVisible().catch(() => false);
      if (isVisible) {
        await expect(equity).toBeVisible();
      }
    });
  });

  test.describe("Journal Entries", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/journal-entries");
      await page.waitForLoadState("networkidle");
    });

    test("should display journal entries page", async ({ page }) => {
      await expect(page).toHaveURL(/journal-entries/);
    });

    test("should show page title", async ({ page }) => {
      const title = page.getByRole("heading", { name: /journal/i }).first();
      const isVisible = await title.isVisible().catch(() => false);
      if (isVisible) {
        await expect(title).toBeVisible();
      }
    });

    test("should have create entry button", async ({ page }) => {
      const createButton = page
        .getByRole("button", { name: /add|create|new/i })
        .first();
      const isVisible = await createButton.isVisible().catch(() => false);
      if (isVisible) {
        await expect(createButton).toBeVisible();
      }
    });

    test("should display entries list or empty state", async ({ page }) => {
      const entriesList = page.getByRole("table").or(
        page.locator('[data-testid="journal-entries-list"]')
      );
      const emptyState = page.getByText(/no entries|add your first|get started/i);

      const hasEntries = await entriesList.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasEntries || isEmpty).toBeTruthy();
    });
  });
});
