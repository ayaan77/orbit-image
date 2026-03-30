import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login form when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[id="login-username"]')).toBeVisible();
    await expect(page.locator('input[id="login-password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[id="login-username"]', "wronguser");
    await page.fill('input[id="login-password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test("logs in with valid credentials and shows dashboard", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[id="login-username"]', "ayan");
    await page.fill('input[id="login-password"]', "ayan");
    await page.click('button[type="submit"]');

    // Wait for login form to disappear (means dashboard loaded)
    await expect(page.locator('input[id="login-username"]')).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Orbit Image")).toBeVisible();
  });

  test("settings modal shows account tab after login", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[id="login-username"]', "ayan");
    await page.fill('input[id="login-password"]', "ayan");
    await page.click('button[type="submit"]');
    await expect(page.locator('input[id="login-username"]')).not.toBeVisible({ timeout: 20000 });

    await page.click('button[aria-label="Settings"]');
    await expect(page.locator("text=Account")).toBeVisible({ timeout: 5000 });
  });
});
