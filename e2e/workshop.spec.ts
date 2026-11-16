// Smoke E2E: the app boots, the workshop renders its four panels, and
// the editor page (its own top-level route since #216) renders the canvas.
import { test, expect } from "@playwright/test";

test("workshop boots with the four panels; the editor page renders the canvas", async ({ page }) => {
  await page.goto("/#workshop");

  // ① the layers, ② the formalism, ③ the reading, ④ the point of view
  await expect(page.getByText("① The layers")).toBeVisible();
  await expect(page.getByText("② The formalism")).toBeVisible();
  await expect(page.getByText("③ The flattened data")).toBeVisible();
  await expect(page.getByText("④ The point of view")).toBeVisible();

  // the graphical model editor is its own top-level page (#216)
  await page.goto("/#editor");
  await expect(page.getByRole("application", { name: /model canvas/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "pointer" })).toBeVisible();
});

test("#239 in the list view, ② the formalism and ③ the flattened data sit side by side", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#workshop");
  await expect(page.getByText("② The formalism")).toBeVisible({ timeout: 10_000 });
  // the workshop opens in the graph view: switch to the list view
  await page.getByRole("button", { name: "list", exact: true }).click();
  const formalism = await page.getByText("② The formalism").first().boundingBox();
  const flattened = await page.getByText("③ The flattened data").first().boundingBox();
  expect(formalism).not.toBeNull();
  expect(flattened).not.toBeNull();
  // same row, ② left of ③ — a regression to a single column fails this
  expect(Math.abs((formalism?.y ?? 0) - (flattened?.y ?? 0))).toBeLessThan(50);
  expect((formalism?.x ?? 0)).toBeLessThan(flattened?.x ?? 0);
});
