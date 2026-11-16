// Access flow E2E (issue #198): without a stored access code, the
// editor's session call is refused (401) and the page must show the
// access-code form instead of blocking or failing silently.
import { test, expect } from "@playwright/test";

test("#editor without an access code shows the access-code form and a heading", async ({ page }) => {
  await page.goto("/#editor");
  // the page renders its title (no infinite loading)
  await expect(page.locator("h1").first()).toContainText(/model editor/i, { timeout: 10_000 });
  // the access-code form is offered, not a silent local fallback
  await expect(page.getByText("site access code", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder("access code")).toBeVisible();
});

// Regression for issue #244: once the site access code is verified, the
// dialog hides itself — after a manual verify, on reload with a stored
// code — and it stays visible when the stored code is wrong. The token
// is the one of the e2e API server (playwright.config.ts); locally, when
// the dev stack is reused, pass E2E_API_TOKEN=<the .env API_TOKEN>.
const E2E_ACCESS_TOKEN = process.env.E2E_API_TOKEN ?? "e2e-test-token";

// Seed localStorage before the app scripts run, mirroring
// writeAccessCode with an explicit consent (code + future expiry).
async function seedStoredAccessCode(page: import("@playwright/test").Page, code: string) {
  await page.addInitScript(
    ([storedCode, consentExpiry]) => {
      localStorage.setItem("code-acces-atelier", storedCode);
      localStorage.setItem("code-acces-atelier-consent", consentExpiry);
    },
    [code, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()],
  );
}

test("#244 a stored valid code hides the access-code form on load", async ({ page }) => {
  await seedStoredAccessCode(page, E2E_ACCESS_TOKEN);
  await page.goto("/#creation");
  // the page renders its title (no infinite loading)
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  // the silent re-verify accepts the stored code: the form hides itself
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
});

test("#244 a stored invalid code keeps the access-code form visible", async ({ page }) => {
  await seedStoredAccessCode(page, "definitely-not-the-token");
  await page.goto("/#creation");
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await expect(page.getByText("site access code", { exact: true })).toBeVisible({ timeout: 10_000 });
  // still visible once the silent re-verify has been refused
  await page.waitForTimeout(1_500);
  await expect(page.getByText("site access code", { exact: true })).toBeVisible();
});

test("#244 verifying the code hides the form, and it stays hidden after reload", async ({ page }) => {
  await page.goto("/#creation");
  const field = page.getByPlaceholder("access code");
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill(E2E_ACCESS_TOKEN);
  await page.getByRole("button", { name: "verify", exact: true }).click();
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
  // the code is kept for the tab: after a reload the form stays hidden
  await page.reload();
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
});
