// Navigation E2E (issue #197, reworked for LD-9): the shared top menu
// presents the three zones of the common contract — Home (plain link),
// Discover and Workshop (popovers listing their pages). The menu is
// present on every route, the current zone carries aria-current="page",
// and clicking a zone entry navigates and re-highlights.
import { test, expect } from "@playwright/test";

const MENU = 'header nav[aria-label="Main navigation"]';

// zone label -> hash of a page inside the zone, and the zone's page links
const ZONES: ReadonlyArray<{ zone: string; hash: string; links: ReadonlyArray<{ hash: string; label: string }> }> = [
  {
    zone: "Home",
    hash: "#landing",
    links: [{ hash: "#landing", label: "Home" }],
  },
  {
    zone: "Discover",
    hash: "#tutorial",
    links: [
      { hash: "#tutorial", label: "Tutorial" },
      { hash: "#filiation", label: "Filiation" },
      { hash: "#lenses", label: "Lenses" },
      { hash: "#install", label: "Install" },
    ],
  },
  {
    zone: "Workshop",
    hash: "#formalisms",
    links: [
      { hash: "#formalisms", label: "Formalisms" },
      { hash: "#models", label: "Models" },
      { hash: "#hierarchy", label: "Hierarchy" },
      { hash: "#creation", label: "Creation" },
    ],
  },
];

// route hash -> the zone that must be highlighted
const ROUTE_ZONE: ReadonlyArray<{ hash: string; zone: string }> = [
  { hash: "#landing", zone: "Home" },
  { hash: "#tutorial", zone: "Discover" },
  { hash: "#filiation", zone: "Discover" },
  { hash: "#lenses", zone: "Discover" },
  { hash: "#install", zone: "Discover" },
  { hash: "#formalisms", zone: "Workshop" },
  { hash: "#models", zone: "Workshop" },
  { hash: "#hierarchy", zone: "Workshop" },
  { hash: "#creation", zone: "Workshop" },
  { hash: "#formalism/petrinet", zone: "Workshop" },
];

test.describe("global navigation zones (LD-9)", () => {
  for (const { hash, zone } of ROUTE_ZONE) {
    test(`menu visible on ${hash} with ${zone} highlighted`, async ({ page }) => {
      await page.goto("/" + hash);
      const nav = page.locator(MENU);
      await expect(nav).toBeVisible();
      // three zones: one plain link (Home) + two popover buttons
      await expect(nav.locator("a")).toHaveCount(1);
      await expect(nav.locator("button")).toHaveCount(2);
      // exactly the current zone is highlighted
      const active = nav.locator('[aria-current="page"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveText(zone);
    });
  }

  test("no zone highlighted on an unknown route", async ({ page }) => {
    await page.goto("/#nimportequoi");
    await expect(page.locator(`${MENU} [aria-current="page"]`)).toHaveCount(0);
  });

  test("each zone popover lists its pages as real hash links", async ({ page }) => {
    await page.goto("/#landing");
    for (const { zone, links } of ZONES) {
      if (links.length === 1) continue; // Home is a plain link
      await page.locator(MENU).getByRole("button", { name: zone }).click();
      for (const { hash, label } of links) {
        await expect(page.locator(MENU).locator("a").filter({ hasText: label })).toHaveAttribute("href", hash);
      }
      await page.keyboard.press("Escape");
    }
  });

  test("clicking a zone entry navigates to its page and re-highlights", async ({ page }) => {
    await page.goto("/#landing");
    await expect(page.locator(MENU)).toBeVisible();
    for (const { zone, hash, links } of ZONES) {
      const target = links[0];
      if (target === undefined) continue;
      if (links.length === 1) {
        await page.locator(MENU).getByRole("link", { name: zone }).click();
      } else {
        await page.locator(MENU).getByRole("button", { name: zone }).click();
        await page.locator(MENU).getByRole("link", { name: target.label }).click();
      }
      await expect(page).toHaveURL(new RegExp(hash + "$"));
      await expect(page.locator(`${MENU} [aria-current="page"]`)).toHaveText(zone);
    }
  });
});
