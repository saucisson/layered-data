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
