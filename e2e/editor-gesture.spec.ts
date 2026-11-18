// Interaction E2E: on the graphical editor, create a living model that
// refines the petrinet formalism (the philosophers' formalism), pick a
// sommet tool, click the canvas — the gesture drafts a .ld block, the
// staging accepts it, the verdict banner appears and the source panel
// shows the drafted block.
import { test, expect } from "@playwright/test";

test("a canvas gesture drafts a .ld block and the staging verdict appears", async ({ page }) => {
  await page.goto("/#models");

  // create a living model refining @petrinet — the corpus stays
  // read-only, only runtime-added layers open in the editor
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-philosophers");
  // the suggested parents are pre-checked — start from petrinet-scheme only
  // start from a clean parent list, then check the wanted formalisms
  for (const box of await page.getByRole("checkbox").all()) await box.uncheck();
  await page.getByRole("checkbox", { name: "petrinet-scheme", exact: true }).check();
  await page.getByRole("button", { name: "staging — create the model" }).click();

  // the new model is auto-selected; the canvas is rendered
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible();

  // pick the first sommet tool of the palette (a vertex container)
  await page.getByRole("button", { name: "places" }).click();

  // a bare click on the canvas drafts the member insertion
  await canvas.click({ position: { x: 320, y: 240 } });

  // the staging verdict appears
  await expect(page.getByText(/staging: 0 failed checks/)).toBeVisible();

  // the drafted .ld block is the only truth: show the source panel
  await page.getByRole("button", { name: "source", exact: true }).click();
  const source = page.locator("pre").first();
  await expect(source).toContainText("layer e2e-philosophers refines @petrinet-scheme");
  await expect(source).toContainText("extend places");
});

test("#228 the lens picker is labeled and its edit button opens the lens DSL page", async ({ page }) => {
  await page.goto("/#models");
  const lensPicker = page.getByLabel("lens");
  await expect(lensPicker).toBeVisible();
  const lensName = String(await lensPicker.inputValue());
  await page.getByRole("link", { name: "edit the lens" }).click();
  await expect(page).toHaveURL(new RegExp(`#formalism/${lensName}$`));
  await expect(page.locator("h1, h2").first()).toContainText(/formalism/i);
});

test("#219 dragging a vertex moves it — the drafted position lands in the source", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#models");
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-drag");
  // start from a clean parent list, then check the wanted formalisms
  for (const box of await page.getByRole("checkbox").all()) await box.uncheck();
  await page.getByRole("checkbox", { name: "pn-philosophers", exact: true }).check();
  await page.getByRole("checkbox", { name: "positions-grid", exact: true }).check();
  await page.getByRole("button", { name: "staging — create the model" }).click();
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "places" }).click();
  await canvas.click({ position: { x: 400, y: 300 } });
  await expect(page.getByText(/staging: 0 failed checks/)).toBeVisible({ timeout: 10_000 });

  // the drafted position is the exact world point under the click:
  // the svg letterboxes its viewBox (meet), so the mapping goes
  // through scale = min(rect/viewBox) + centered offsets (#221)
  const canvasBox = await canvas.boundingBox();
  const scale = Math.min(canvasBox!.width / 960, canvasBox!.height / 540);
  const offsetX = (canvasBox!.width - 960 * scale) / 2;
  const offsetY = (canvasBox!.height - 540 * scale) / 2;
  const expectedX = Math.round((400 - offsetX) / scale);
  const expectedY = Math.round((300 - offsetY) / scale);

  // the initial position, as drafted in the source
  await page.getByRole("button", { name: "source" }).click();
  const source = page.locator("text=/x = /").first();
  const before = await source.textContent();
  const xBefore = Number(/x = (\d+)/.exec(before ?? "")?.[1]);
  const yBefore = Number(/y = (\d+)/.exec(before ?? "")?.[1]);
  // within a few world units — the click point carries sub-pixel
  // rounding; the old letterboxing bug was off by ~100
  expect(Math.abs(xBefore - expectedX)).toBeLessThanOrEqual(3);
  expect(Math.abs(yBefore - expectedY)).toBeLessThanOrEqual(3);
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

test("#221 the canvas takes the available width and height; palette and inspector stay narrow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#models");
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-layout");
  // start from a clean parent list, then check the wanted formalisms
  for (const box of await page.getByRole("checkbox").all()) await box.uncheck();
  await page.getByRole("checkbox", { name: "pn-philosophers", exact: true }).check();
  await page.getByRole("checkbox", { name: "positions-grid", exact: true }).check();
  await page.getByRole("button", { name: "staging — create the model" }).click();
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "source" }).click();
  await page.waitForTimeout(300);

  const canvasBox = await canvas.boundingBox();
  const paletteBox = await page
    .getByText("palette", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
    .boundingBox();
  const inspectorBox = await page
    .getByText("inspector", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
    .boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(paletteBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  // the canvas fills the available height (100vh - 13rem = 692px here)
  expect(canvasBox!.height).toBeGreaterThan(600);
  // palette left, canvas middle, inspector right — the canvas keeps
  // the width between them
  expect(paletteBox!.x).toBeLessThan(canvasBox!.x);
  expect(canvasBox!.x + canvasBox!.width).toBeLessThan(inspectorBox!.x);
  expect(canvasBox!.width).toBeGreaterThan(paletteBox!.width * 2);
});

test("#218 the palette shows only the chosen formalism's elements, as shapes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#models");
  await page.getByRole("button", { name: "+ new model" }).click();
  await page.getByPlaceholder("model name").fill("e2e-palette");
  // start from a clean parent list, then check the wanted formalisms
  for (const box of await page.getByRole("checkbox").all()) await box.uncheck();
  await page.getByRole("checkbox", { name: "petrinet-scheme", exact: true }).check();
  await page.getByRole("button", { name: "staging — create the model" }).click();
  await page.getByRole("application", { name: /model canvas/ }).waitFor({ state: "visible", timeout: 10_000 });

  const palette = page.locator("xpath=//div[contains(@class,'lg:w-44')]");
  const names = await palette.locator("button").allTextContents();
  // the petrinet vocabulary — no left/right leaked from bipartite-digraph
  expect(names.some((name) => name.includes("places"))).toBe(true);
  expect(names.some((name) => name.includes("transitions"))).toBe(true);
  expect(names.some((name) => name.includes("arc"))).toBe(true);
  expect(names.some((name) => name.includes("left"))).toBe(false);
  expect(names.some((name) => name.includes("right"))).toBe(false);
  // each element is drawn by its shape (an inline svg glyph), not only named
  await expect(palette.locator("button svg").first()).toBeVisible();
});

test("#220 an arc carries waypoints — double-click bends it, drag moves the handle, double-click removes it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#models");

  // import a complete model: one place, one transition, one arc
  const modelSource = [
    "layer e2e-waypoints refines @petrinet-scheme",
    "  extend places",
    "    p1 refines @petrinet-scheme/specification/place_type",
    "  extend transitions",
    "    t1 refines @petrinet-scheme/specification/transition_type",
    "  extend pre_arcs",
    "    a1 refines @petrinet-scheme/specification/pre_arc_type",
    "      source = @e2e-waypoints/places/p1",
    "      target = @e2e-waypoints/transitions/t1",
    "",
  ].join("\n");
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-waypoints.ld",
    mimeType: "text/plain",
    buffer: Buffer.from(modelSource),
  });
  const canvas = page.getByRole("application", { name: /model canvas/ });
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/staging accepted it|0 failed checks/)).toBeVisible({ timeout: 10_000 });

  // the arc is drawn between the two vertices
  const edge = page.locator("g[data-edge]").first();
  await expect(edge).toBeVisible();

  // a double-click on the arc bends it: a waypoint lands in the source
  const edgeBox = await edge.boundingBox();
  await page.mouse.dblclick(edgeBox!.x + edgeBox!.width / 2, edgeBox!.y + edgeBox!.height / 2);
  await expect(page.getByText(/staging: 0 failed checks/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "source" }).click();
  const source = page.locator("pre").first();
  await expect(source).toContainText(/waypoints = "\d+,\d+"/);
  const before = await source.textContent();
  const waypointBefore = /waypoints = "(\d+),(\d+)"/.exec(before ?? "")?.slice(1);
  await page.getByRole("button", { name: "source" }).click();

  // the selected arc shows its waypoint as a draggable handle
  await edge.click();
  const handle = page.locator("circle[data-waypoint]").first();
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 60, handleBox!.y + handleBox!.height / 2 + 40, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByText(/staging: 0 failed checks/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "source" }).click();
  const after = await source.textContent();
  const waypointAfter = /waypoints = "(\d+),(\d+)"/.exec(after ?? "")?.slice(1);
  expect(waypointAfter).not.toBeNull();
  expect(waypointAfter).not.toEqual(waypointBefore);
  await page.getByRole("button", { name: "source" }).click();

  // a double-click on the handle removes the waypoint
  await page.locator("circle[data-waypoint]").first().dblclick();
  await expect(page.getByText(/staging: 0 failed checks/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "source" }).click();
  await expect(page.locator("pre").first()).toContainText('waypoints = ""');
});
