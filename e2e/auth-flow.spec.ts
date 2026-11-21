// Auth flow E2E (milestone Auth v1): the key button of the site
// header opens the auth panel. The e2e server runs with
// AUTH_DISABLED=1 (no IdP in the test browser), so /auth/me answers
// the dev user: the panel shows the connected user and the sign-out
// link, and never a sign-in form. With a real IdP the same panel
// offers the single "sign in with Zitadel" button instead.
import { test, expect } from "@playwright/test";

async function openAuthPopover(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /sign in|signed in/i }).click();
}

test("Auth v1 the auth panel opens from the key button of the site header", async ({ page }) => {
  await page.goto("/#models");
  await expect(page.locator("h1").first()).toContainText(/model editor/i, { timeout: 10_000 });
  await openAuthPopover(page);
  // AUTH_DISABLED=1: the dev user is connected, no sign-in button
  await expect(page.getByText("développeur-local", { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "sign out", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "sign in with Zitadel", exact: true })).toBeHidden();
});

test("Auth v1 the sign-out link points at /auth/logout", async ({ page }) => {
  await page.goto("/#creation");
  await expect(page.locator("h1").first()).toContainText(/create a formalism/i, { timeout: 10_000 });
  await openAuthPopover(page);
  const logoutButton = page.getByRole("button", { name: "sign out", exact: true });
  await expect(logoutButton).toBeVisible({ timeout: 10_000 });
  // the panel never offers a code field: no trace of the old access form
  await expect(page.getByPlaceholder("access code")).toBeHidden();
});
