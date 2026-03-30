import { test, expect } from "@playwright/test";

test.describe("Studio Page", () => {
  test("loads and shows purpose selection", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.locator("text=Blog Hero")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Social Media")).toBeVisible();
    await expect(page.locator("text=Ad Creative")).toBeVisible();
  });

  test("404 page shows for invalid routes", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.locator("text=404")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Go to Dashboard")).toBeVisible();
    await expect(page.locator("text=Try Studio")).toBeVisible();
  });
});

test.describe("Admin Panel", () => {
  test("blocks unauthenticated users", async ({ page }) => {
    await page.goto("/admin");
    // Should show access denied or loading spinner (not admin content)
    await expect(page.locator("text=Access denied")).toBeVisible({ timeout: 10000 });
  });

  test("shows admin panel after login", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[id="login-username"]', "ayan");
    await page.fill('input[id="login-password"]', "ayan");
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Orbit Image', { timeout: 30000 });

    await page.goto("/admin");
    await expect(page.locator("text=Orbit Admin")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Users")).toBeVisible();
    await expect(page.locator("text=Tokens")).toBeVisible();
  });

  test("admin has back-to-app link", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[id="login-username"]', "ayan");
    await page.fill('input[id="login-password"]', "ayan");
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Orbit Image', { timeout: 30000 });

    await page.goto("/admin");
    await expect(page.locator("text=Back to App")).toBeVisible({ timeout: 10000 });
  });
});
