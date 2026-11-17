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
  { hash: "#lenses", heading: /Lenses/ },
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

test("#217 the workshop header and the hierarchy page render the SAME shared refinement graph", async ({ page }) => {
  // the hierarchy page: pill per layer + one svg curve per refinement
  await page.goto("/#hierarchy");
  await expect(page.getByRole("heading", { name: /hierarchy/i })).toBeVisible();
  const hierarchyPill = page.getByRole("button", { name: "petrinet-scheme", exact: true });
  await expect(hierarchyPill).toBeVisible({ timeout: 15_000 });
  const hierarchyCurves = page.locator("svg path[marker-end]");
  await expect(hierarchyCurves.first()).toBeVisible();
  expect(await hierarchyCurves.count()).toBeGreaterThan(10);

  // the workshop header: the same component — same pill, same curves
  await page.goto("/#workshop");
  await expect(page.getByRole("heading", { name: /workshop/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "graph", exact: true }).first().click();
  const workshopPill = page.getByRole("button", { name: /^petrinet-scheme/ });
  await expect(workshopPill).toBeVisible({ timeout: 15_000 });
  const workshopCurves = page.locator("svg path[marker-end]");
  await expect(workshopCurves.first()).toBeVisible();
  expect(await workshopCurves.count()).toBeGreaterThan(10);
});

test("#235 the hierarchy draws two arrow kinds — solid inheritance, dashed usage", async ({ page }) => {
  await page.goto("/#hierarchy");
  await expect(page.getByRole("heading", { name: /hierarchy/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "petrinet-scheme", exact: true })).toBeVisible({ timeout: 15_000 });
  // solid inheritance curves (filled arrowhead marker)
  const solid = page.locator("svg path[marker-end]:not([stroke-dasharray])");
  await expect(solid.first()).toBeVisible();
  expect(await solid.count()).toBeGreaterThan(10);
  // dashed usage curves (hollow arrowhead) — petrinet-view uses petrinet-display
  const dashed = page.locator("svg path[stroke-dasharray]");
  await expect(dashed.first()).toBeVisible();
  expect(await dashed.count()).toBeGreaterThan(0);
});

test("#231 the hierarchy groups the formalisms by families — chips fade the other families", async ({ page }) => {
  await page.goto("/#hierarchy");
  await expect(page.getByRole("heading", { name: /hierarchy/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "petrinet-scheme", exact: true })).toBeVisible({ timeout: 15_000 });
  // one chip per family + the "all families" chip
  const allChip = page.getByRole("button", { name: "all families", exact: true });
  await expect(allChip).toBeVisible();
  const familyChip = page.getByRole("button", { name: /^petrinet-scheme · \d+$/ });
  await expect(familyChip).toBeVisible();

  // click the family chip: the layers outside the family fade (opacity-10)
  await familyChip.click();
  const outsidePill = page.getByRole("button", { name: "multihypergraph", exact: true });
  await expect(outsidePill).toHaveClass(/\bopacity-10\b/);
  const insidePill = page.getByRole("button", { name: "pt-petrinet", exact: true });
  await expect(insidePill).not.toHaveClass(/\bopacity-10\b/);

  // back to all
  await allChip.click();
  await expect(outsidePill).not.toHaveClass(/\bopacity-10\b/);
  await expect(page.getByRole("button", { name: "petrinet-scheme", exact: true })).not.toHaveClass(/\bopacity-10\b/);
});
