import { test, expect } from "@playwright/test";

// Shared login helper
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.fill('input[id="login-username"]', "ayan");
  await page.fill('input[id="login-password"]', "ayan");
  await page.click('button[type="submit"]');
  // Wait for the header to appear (means auth passed and dashboard rendered)
  await page.waitForSelector('text=Orbit Image', { timeout: 30000 });
  // Extra pause for dynamic tab content to hydrate
  await page.waitForTimeout(1000);
}

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("all 6 tabs are visible in sidebar", async ({ page }) => {
    const tabs = ["Overview", "Connect", "Apps", "Playground", "Usage", "Quick Start"];
    for (const tab of tabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test("clicking Connect tab shows MCP config UI", async ({ page }) => {
    await page.click('button:has-text("Connect")');
    await expect(page.locator("text=Generate Token")).toBeVisible({ timeout: 5000 });
  });

  test("clicking Playground tab shows generation form", async ({ page }) => {
    await page.click('button:has-text("Playground")');
    await expect(page.locator("text=Send Request")).toBeVisible({ timeout: 5000 });
  });

  test("clicking Quick Start tab shows integration guide", async ({ page }) => {
    await page.click('button:has-text("Quick Start")');
    await expect(page.locator("text=Test Connection")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Connect Tab", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("Connect")');
    await expect(page.locator("text=Generate Token")).toBeVisible({ timeout: 5000 });
  });

  test("shows 4 client config cards", async ({ page }) => {
    await expect(page.locator("text=Claude Desktop")).toBeVisible();
    await expect(page.locator("text=Cursor")).toBeVisible();
    await expect(page.locator("text=Claude Code (CLI)")).toBeVisible();
    await expect(page.locator("text=Other MCP Client")).toBeVisible();
  });

  test("shows available MCP tools", async ({ page }) => {
    await expect(page.locator("text=generate-image")).toBeVisible();
    await expect(page.locator("text=list-models")).toBeVisible();
    await expect(page.locator("text=list-brands")).toBeVisible();
  });

  test("generates token and updates config cards", async ({ page }) => {
    await page.fill('input[placeholder*="sarah-cursor"]', "e2e-test-token");
    await page.click('button:has-text("Generate Token")');

    // Should show the token
    await expect(page.locator("text=Your MCP Token")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=/oimg_live_/")).toBeVisible();
    await expect(page.locator("text=Save this token now")).toBeVisible();
  });
});
