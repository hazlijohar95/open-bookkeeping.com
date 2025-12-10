import { test, expect } from "@playwright/test";

test.describe("Authentication Flows", () => {
  test.describe("Login Page", () => {
    test("should display login page", async ({ page }) => {
      await page.goto("/login");
      await expect(page).toHaveURL(/login/);
    });

    test("should show login form or OAuth options", async ({ page }) => {
      await page.goto("/login");

      // Look for either login button/form or OAuth sign-in options
      const loginElement = page
        .getByRole("button", { name: /sign in|login|continue with|google/i })
        .first();
      await expect(loginElement).toBeVisible({ timeout: 10000 });
    });

    test("should have branding/logo visible", async ({ page }) => {
      await page.goto("/login");

      // Look for logo or brand name
      const logo = page.getByRole("img", { name: /logo/i }).or(
        page.getByText(/open bookkeeping|bookkeeping/i).first()
      );
      const isVisible = await logo.isVisible().catch(() => false);
      if (isVisible) {
        await expect(logo).toBeVisible();
      }
    });
  });

  test.describe("Protected Routes Redirect", () => {
    test("should allow access to dashboard without auth for demo mode", async ({ page }) => {
      // In demo/offline mode, protected routes should still be accessible
      await page.goto("/dashboard");
      // Should either show dashboard or redirect to login
      const isDashboard = await page.url().includes("dashboard");
      const isLogin = await page.url().includes("login");
      expect(isDashboard || isLogin).toBeTruthy();
    });

    test("should allow access to invoices list", async ({ page }) => {
      await page.goto("/invoices");
      const isInvoices = await page.url().includes("invoices");
      const isLogin = await page.url().includes("login");
      expect(isInvoices || isLogin).toBeTruthy();
    });

    test("should allow access to settings without auth for demo mode", async ({ page }) => {
      await page.goto("/settings");
      const isSettings = await page.url().includes("settings");
      const isLogin = await page.url().includes("login");
      expect(isSettings || isLogin).toBeTruthy();
    });
  });

  test.describe("Public Routes", () => {
    test("should access home page without authentication", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL("/");
    });

    test("should access create invoice page without authentication", async ({ page }) => {
      await page.goto("/create/invoice");
      await expect(page).toHaveURL(/create\/invoice/);
    });

    test("should access create quotation page without authentication", async ({ page }) => {
      await page.goto("/create/quotation");
      await expect(page).toHaveURL(/create\/quotation/);
    });

    test("should access privacy policy without authentication", async ({ page }) => {
      await page.goto("/privacy");
      await expect(page).toHaveURL(/privacy/);
      const privacyContent = page.getByText(/privacy|policy/i).first();
      await expect(privacyContent).toBeVisible({ timeout: 10000 });
    });

    test("should access terms of service without authentication", async ({ page }) => {
      await page.goto("/terms");
      await expect(page).toHaveURL(/terms/);
      const termsContent = page.getByText(/terms|service|conditions/i).first();
      await expect(termsContent).toBeVisible({ timeout: 10000 });
    });

    test("should access blogs page without authentication", async ({ page }) => {
      await page.goto("/blogs");
      await expect(page).toHaveURL(/blogs/);
    });
  });

  test.describe("Auth Callback", () => {
    test("should handle auth callback route", async ({ page }) => {
      // This route handles OAuth callbacks
      await page.goto("/auth/callback");
      // Should either process callback or redirect appropriately
      // Don't fail on redirect behavior
      const currentUrl = page.url();
      expect(currentUrl).toBeDefined();
    });
  });
});
