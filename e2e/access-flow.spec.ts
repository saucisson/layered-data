// Access flow E2E (issues #198, #222, #244): the site access code is
// asked from the key button of the site header (one click, #222) —
// without a stored code the form is offered there, not on each page;
// once verified the form hides itself (#244) and stays hidden.
import { test, expect } from "@playwright/test";

// The key button of the site header opens the access-code popover.
async function openAccessCodePopover(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "site access code" }).click();
}

test("#222 the access-code form opens from the key button of the site header", async ({ page }) => {
  await page.goto("/#models");
  // the page renders its title (no infinite loading)
  await expect(page.locator("h1").first()).toContainText(/model editor/i, { timeout: 10_000 });
  // the form is not on the page itself anymore…
  await expect(page.getByText("site access code", { exact: true })).toBeHidden();
  // …but one click on the header's key button offers it
  await openAccessCodePopover(page);
  await expect(page.getByText("site access code", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder("access code")).toBeVisible();
});

// Regression for issue #244: once the site access code is verified, the
// dialog hides itself — after a manual verify, when reopened with a
// stored code — and it stays visible when the stored code is wrong.
// The token is the one of the e2e API server (playwright.config.ts);
// locally, when the dev stack is reused, pass E2E_API_TOKEN=<the .env
// API_TOKEN>.
const E2E_ACCESS_TOKEN = process.env.E2E_API_TOKEN ?? "e2e-test-token";

// Seed localStorage before the app scripts run, mirroring
// writeAccessCode with an explicit consent (code + future expiry).
async function seedStoredAccessCode(page: import("@playwright/test").Page, code: string) {
  const seed: [string, string] = [code, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()];
  await page.addInitScript(([storedCode, consentExpiry]: [string, string]) => {
    localStorage.setItem("code-acces-atelier", storedCode);
    localStorage.setItem("code-acces-atelier-consent", consentExpiry);
  }, seed);
}

test("#244 a stored valid code hides the access-code form when the popover opens", async ({ page }) => {
  await seedStoredAccessCode(page, E2E_ACCESS_TOKEN);
  await page.goto("/#creation");
  // the page renders its title (no infinite loading)
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await openAccessCodePopover(page);
  // the silent re-verify accepts the stored code: the form hides itself
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
});

test("#244 a stored invalid code keeps the access-code form visible", async ({ page }) => {
  await seedStoredAccessCode(page, "definitely-not-the-token");
  await page.goto("/#creation");
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await openAccessCodePopover(page);
  await expect(page.getByText("site access code", { exact: true })).toBeVisible({ timeout: 10_000 });
  // still visible once the silent re-verify has been refused
  await page.waitForTimeout(1_500);
  await expect(page.getByText("site access code", { exact: true })).toBeVisible();
});

test("#244 verifying the code hides the form, and it stays hidden after reload", async ({ page }) => {
  await page.goto("/#creation");
  await openAccessCodePopover(page);
  const field = page.getByPlaceholder("access code");
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill(E2E_ACCESS_TOKEN);
  await page.getByRole("button", { name: "verify", exact: true }).click();
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
  // the code is kept for the tab: after a reload the form stays hidden
  await page.reload();
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await openAccessCodePopover(page);
  await expect(page.getByText("site access code", { exact: true })).toBeHidden({ timeout: 10_000 });
});
