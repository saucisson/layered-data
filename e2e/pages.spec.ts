// Pages E2E (issue #197): every route renders its main heading within a
// bounded time and produces no console errors / page errors.
//
// Known exception: #editor calls /api/editor/session, which answers 401
// when no access code is stored — tracked by issue #198 (the page must
// show the access-code form instead of blocking). Until then, those 401
// resource errors are filtered out here.
import { test, expect, type Page } from "@playwright/test";

const ROUTES: ReadonlyArray<{ hash: string; heading: RegExp }> = [
  { hash: "#landing", heading: /Layered Data/ },
  { hash: "#tutorial", heading: /philosophers/i },
  { hash: "#filiation", heading: /Filiation/ },
  { hash: "#hierarchy", heading: /hierarchy/i },
  { hash: "#creation", heading: /Create a formalism/ },
  { hash: "#workshop", heading: /workshop/i },
  { hash: "#formalism/petrinet", heading: /formalism/i },
  { hash: "#nimportequoi", heading: /Page not found/ },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Known until #198 lands: the editor session call is unauthorized
    // without an access code.
    if (text.includes("401")) return;
    errors.push(text);
  });
  return errors;
}

test.describe("every page renders without errors", () => {
  for (const { hash, heading } of ROUTES) {
    test(`${hash} renders its heading within 10s, no console errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/" + hash);
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("h1, h2").first()).toContainText(heading);
      expect(errors).toEqual([]);
    });
  }
});
