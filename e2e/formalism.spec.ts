// Formalism page E2E (issue #224): clicking a line of the DSL source
// unfolds the equivalent entry in the flattened view, scrolls to it
// and flashes it.
import { test, expect } from "@playwright/test";

test("#224 a click on a DSL line reveals the equivalent in the flattened formalism", async ({ page }) => {
  await page.goto("/#formalism/petrinet-scheme");

  const sourcePanel = page.locator("section").filter({ hasText: "The DSL of the formalism" });
  await expect(sourcePanel).toBeVisible({ timeout: 10_000 });

  // the "extend specification" line is clickable (it designates an
  // address); the comment lines above it are not
  const line = sourcePanel.locator("div.cursor-pointer", { hasText: "extend specification" }).first();
  await expect(line).toBeVisible();
  await line.click();

  // the equivalent entry in the flattened view is rendered (unfolded)
  // and flashes
  const flashed = page.locator("[data-flat-key].bg-amber-100").first();
  await expect(flashed).toBeVisible();
  await expect(flashed).toContainText("specification");
});
