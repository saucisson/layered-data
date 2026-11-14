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
