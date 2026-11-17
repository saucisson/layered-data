// Navigation E2E (issue #197): the shared top menu is present on every
// route, its entries are real links to the right hashes, the current
// page carries aria-current="page", and clicking an entry navigates and
// re-highlights.
import { test, expect } from "@playwright/test";

const MENU = 'header nav[aria-label="Main navigation"]';

const ROUTES: ReadonlyArray<{ hash: string; label: string }> = [
  { hash: "#landing", label: "Landing" },
  { hash: "#tutorial", label: "Tutorial" },
  { hash: "#filiation", label: "Filiation" },
  { hash: "#hierarchy", label: "Hierarchy" },
  { hash: "#creation", label: "Creation" },
  { hash: "#workshop", label: "Formalisms" },
  { hash: "#lenses", label: "Lenses" },
  { hash: "#editor", label: "Models" },
  { hash: "#install", label: "Install" },
];

// Routes on which no menu entry is active (detail pages).
const NO_ACTIVE: ReadonlyArray<string> = ["#formalism/petrinet", "#nimportequoi"];

test.describe("global navigation menu", () => {
  for (const { hash, label } of ROUTES) {
    test(`menu visible on ${hash} with ${label} highlighted`, async ({ page }) => {
      await page.goto("/" + hash);
      const nav = page.locator(MENU);
      await expect(nav).toBeVisible();
      // nine plain-text entries, real hash links
      const links = nav.locator("a");
      await expect(links).toHaveCount(9);
      for (const { hash: entryHash, label: entryLabel } of ROUTES) {
        await expect(links.filter({ hasText: entryLabel })).toHaveAttribute("href", entryHash);
      }
      // exactly the current page is highlighted
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(label);
    });
  }

  test("#editor highlights its own Models entry (two top-level pages, #216)", async ({ page }) => {
    await page.goto("/#editor");
    await expect(page.locator(`${MENU} a[aria-current="page"]`)).toHaveText("Models");
  });

  for (const hash of NO_ACTIVE) {
    test(`no entry highlighted on ${hash}`, async ({ page }) => {
      await page.goto("/" + hash);
      await expect(page.locator(`${MENU} a[aria-current="page"]`)).toHaveCount(0);
    });
  }

  test("clicking each menu entry navigates to its page and re-highlights", async ({ page }) => {
    await page.goto("/#landing");
    await expect(page.locator(MENU)).toBeVisible();
    for (const { hash, label } of ROUTES) {
      await page.locator(MENU).locator("a").filter({ hasText: label }).click();
      await expect(page).toHaveURL(new RegExp(hash.replace("#", "#") + "$"));
      await expect(page.locator(`${MENU} a[aria-current="page"]`)).toHaveText(label);
    }
  });
});
