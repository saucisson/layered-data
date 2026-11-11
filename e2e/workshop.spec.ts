// Smoke E2E: the app boots, the workshop renders its four panels, and
// the graphical editor tab opens with its canvas.
import { test, expect } from "@playwright/test";

test("workshop boots with the four panels; the editor tab renders the canvas", async ({ page }) => {
  await page.goto("/#workshop");

  // ① the layers, ② the formalism, ③ the reading, ④ the point of view
  await expect(page.getByText("① The layers")).toBeVisible();
  await expect(page.getByText("② The formalism")).toBeVisible();
  await expect(page.getByText("③ The flattened data")).toBeVisible();
  await expect(page.getByText("④ The point of view")).toBeVisible();

  // the second tab of the one-page workshop: the graphical model editor
  await page.getByRole("button", { name: "the graphical model editor" }).click();
  await expect(page).toHaveURL(/#editor$/);
  await expect(page.getByRole("application", { name: /model canvas/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "pointer" })).toBeVisible();
});
