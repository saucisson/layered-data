// Interaction E2E: on the graphical editor, create a living model that
// refines the petrinet formalism (the philosophers' formalism), pick a
// sommet tool, click the canvas — the gesture drafts a .ld block, the
// staging accepts it, the verdict banner appears and the source panel
// shows the drafted block.
import { test, expect } from "@playwright/test";

test("a canvas gesture drafts a .ld block and the staging verdict appears", async ({ page }) => {
  await page.goto("/#editor");

  // create a living model refining @petrinet — the corpus stays
  // read-only, only runtime-added layers open in the editor
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-philosophers");
  await page.locator("input.w-72").fill("@petrinet-scheme");
  await page.getByRole("button", { name: "staging — create the model" }).click();

  // the new model is auto-selected; the canvas is rendered
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible();

  // pick the first sommet tool of the palette (a vertex container)
  await page.getByRole("button", { name: "places" }).click();

  // a bare click on the canvas drafts the member insertion
  await canvas.click({ position: { x: 320, y: 240 } });

  // the staging verdict appears
  await expect(page.getByText(/staging: 0 verdict/)).toBeVisible();

  // the drafted .ld block is the only truth: show the source panel
  await page.getByRole("button", { name: "source", exact: true }).click();
  const source = page.locator("pre").first();
  await expect(source).toContainText("layer e2e-philosophers refines @petrinet-scheme");
  await expect(source).toContainText("extend places");
});
