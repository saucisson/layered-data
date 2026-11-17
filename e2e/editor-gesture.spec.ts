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

test("#228 the lens picker is labeled and its edit button opens the lens DSL page", async ({ page }) => {
  await page.goto("/#editor");
  const lensPicker = page.getByLabel("lens");
  await expect(lensPicker).toBeVisible();
  const lensName = String(await lensPicker.inputValue());
  await page.getByRole("button", { name: "edit the lens" }).click();
  await expect(page).toHaveURL(new RegExp(`#formalism/${lensName}$`));
  await expect(page.locator("h1, h2").first()).toContainText(/formalism/i);
});

test("#219 dragging a vertex moves it — the drafted position lands in the source", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-drag");
  await page.locator("input.w-72").fill("@pn-philosophers then @positions-grid");
  await page.getByRole("button", { name: "staging — create the model" }).click();
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "places" }).click();
  await canvas.click({ position: { x: 400, y: 300 } });
  await expect(page.getByText(/staging: 0 verdict/)).toBeVisible({ timeout: 10_000 });

  // the initial position, as drafted in the source
  await page.getByRole("button", { name: "source" }).click();
  const source = page.locator("text=/x = /").first();
  const before = await source.textContent();
  const xBefore = Number(/x = (\d+)/.exec(before ?? "")?.[1]);
  const yBefore = Number(/y = (\d+)/.exec(before ?? "")?.[1]);
  expect(Number.isFinite(xBefore)).toBe(true);
  await page.getByRole("button", { name: "source" }).click();

  // drag the vertex by (+120, +80) screen px
  const vertex = page.locator('g[style*="grab"]').first();
  const box = await vertex.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 80, { steps: 10 });
  await page.mouse.up();

  // the source block carries the new position (the drag was not a pan)
  await page.getByRole("button", { name: "source" }).click();
  const after = await source.textContent();
  const xAfter = Number(/x = (\d+)/.exec(after ?? "")?.[1]);
  const yAfter = Number(/y = (\d+)/.exec(after ?? "")?.[1]);
  expect(xAfter).toBeGreaterThan(xBefore);
  expect(yAfter).toBeGreaterThan(yBefore);
});
