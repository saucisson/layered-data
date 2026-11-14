// Pages E2E (issue #197): every route renders its main heading within a
// bounded time and produces no console errors / page errors.
//
// Known exception: #editor calls /api/editor/session, which answers 401
// when no access code is stored — the page shows the access-code form
// instead (issue #198). Those specific 401s are filtered by URL below.
import { test, expect, type Page } from "@playwright/test";

const ROUTES: ReadonlyArray<{ hash: string; heading: RegExp }> = [
  { hash: "#landing", heading: /Layered Data/ },
  { hash: "#tutorial", heading: /philosophers/i },
  { hash: "#filiation", heading: /Filiation/ },
  { hash: "#hierarchy", heading: /hierarchy/i },
  { hash: "#creation", heading: /Create a formalism/ },
  { hash: "#workshop", heading: /workshop/i },
  { hash: "#editor", heading: /model editor/i },
  { hash: "#formalism/petrinet", heading: /formalism/i },
  { hash: "#nimportequoi", heading: /Page not found/ },
];

/** Console/page errors, excluding the known unauthorized session call
 * (401 on /api/editor/session without a stored access code, #198) and
 * the "Failed to load resource" console noise that duplicates HTTP
 * error responses already collected via the response listener. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => {
    const knownRefusal = response.status() === 401 && response.url().includes("/api/editor/session");
    if (response.status() >= 400 && !knownRefusal) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("Failed to load resource")) return;
    errors.push(message.text());
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
