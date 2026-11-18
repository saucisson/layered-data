// L3 (issue #285): per-node sizes as data — the `sizes` block of the
// model (or the viewpoint), the cascade viewpoint > model > gabarit
// default, the scaled/rotated rendering geometry, and the editor's
// drafting of the datum.
//
//     node tests/node-sizes-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import { draftMemberSize, sizeContainerOf, readMemberContainers } from "../src/application/modelEditing.ts";
import { type Glyph } from "../src/domain/views.ts";
import { sizeOf } from "../src/presentation/viewTree.ts";
import { buildWorkshopLook } from "../src/presentation/lensDrawing.ts";
import { glyphBounds, scaledGlyph } from "../src/presentation/glyphGeometry.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the kernel (90 layers, node-sizes included) -------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });
const bedrock = kernel.layerNames.map(String);

check(
  "the kernel assembles 90 layers with 0 verdicts (node-sizes included)",
  kernel.layerNames.length === 90 && kernel.validation.verdicts.length === 0,
);

const stage = (draftSource: string, previous: string[], living: string[]) =>
  stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: previous,
    draftSource,
    livingLayerNames: living,
    readonlyLayerNames: bedrock,
  });

// ---- a model carrying a sizes block ---------------------------------

const modelDraft =
  "layer my-buchi refines @moore-traffic-light then @buchi-automaton then @node-sizes\n" +
  "  extend states\n" +
  "    extend green\n" +
  "      accepting = true\n" +
  "  extend sizes\n" +
  "    green refines @node-sizes/specification/size_type\n" +
  "      scale = 2\n" +
  "      angle = 45\n";
const modelStaging = stage(modelDraft, [], bedrock);
check("the model with a sizes block is accepted", modelStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: modelStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

check(
  "sizeOf reads the datum (scale 2, angle 45) and null when absent",
  sizeOf({ space: kernel.space, source: "my-buchi", container: "sizes", name: "green" }) !== null &&
    sizeOf({ space: kernel.space, source: "my-buchi", container: "sizes", name: "green" })!.scale === 2 &&
    sizeOf({ space: kernel.space, source: "my-buchi", container: "sizes", name: "green" })!.angle === 45 &&
    sizeOf({ space: kernel.space, source: "my-buchi", container: "sizes", name: "red" }) === null,
);

// ---- the workshop cascade -------------------------------------------

const look = buildWorkshopLook({
  space: kernel.space,
  selectedView: "automaton-display",
  currentLayer: "my-buchi",
});
const greenLook = look.vertices.find((vertex) => vertex.name === "green");
const redLook = look.vertices.find((vertex) => vertex.name === "red");
check(
  "buildWorkshopLook carries the datum on green, the default on red",
  greenLook !== undefined &&
    greenLook.size.scale === 2 &&
    greenLook.size.angle === 45 &&
    redLook !== undefined &&
    redLook.size.scale === 1 &&
    redLook.size.angle === 0,
);

// a viewpoint carrying sizes wins over the model's
const viewpointDraft =
  "layer my-view refines @view-scheme then @node-sizes\n" +
  "  override model = @my-buchi\n" +
  "  override display = @automaton-display\n" +
  "  extend sizes\n" +
  "    green refines @node-sizes/specification/size_type\n" +
  "      scale = 3\n";
const viewpointStaging = stage(viewpointDraft, [modelDraft], [...bedrock, "my-buchi"]);
check("the viewpoint with its own sizes block is accepted", viewpointStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: viewpointStaging,
  knownLayerNames: [...bedrock, "my-buchi"],
  readonlyLayerNames: bedrock,
});
const viewLook = buildWorkshopLook({
  space: kernel.space,
  selectedView: "my-view",
  currentLayer: "my-buchi",
});
const greenView = viewLook.vertices.find((vertex) => vertex.name === "green");
check(
  "the viewpoint's sizes win over the model's (scale 3, angle falls back to 0)",
  greenView !== undefined && greenView.size.scale === 3 && greenView.size.angle === 0,
);

// ---- the rendering geometry ------------------------------------------

const circle = { shape: "circle", r: 16 } as Glyph;
check(
  "scaledGlyph multiplies the dimensions and the path's numbers, leaves the line alone",
  (scaledGlyph(circle, 2) as { r?: number }).r === 32 &&
    (scaledGlyph({ shape: "rectangle", w: 44, h: 24 }, 0.5) as { w?: number }).w === 22 &&
    (scaledGlyph({ shape: "path", d: "M0,0 L10,20 Z" }, 2) as { d: string }).d === "M0,0 L20,40 Z" &&
    scaledGlyph({ shape: "line", arrow: "plain" }, 3).shape === "line" &&
    scaledGlyph(circle, 1) === circle,
);
check(
  "glyphBounds rotates the corners (a 44x24 rectangle at 90° is 24x44 wide)",
  Math.abs(glyphBounds({ shape: "rectangle", w: 44, h: 24 }, 90).x1 - 12) < 1e-9 &&
    Math.abs(glyphBounds({ shape: "rectangle", w: 44, h: 24 }, 90).y1 - 22) < 1e-9 &&
    glyphBounds(circle, 45).x1 === 16,
);

// ---- the editor's drafting -------------------------------------------

const containers = readMemberContainers({ space: kernel.space, model: "my-buchi" });
const sizeContainer = sizeContainerOf({ containers });
check(
  "sizeContainerOf finds the sizes container by its data (scale+angle), not by name",
  sizeContainer !== null && sizeContainer.name === "sizes",
);

const baseBlock =
  "layer my-buchi refines @moore-traffic-light then @buchi-automaton then @node-sizes\n" +
  "  extend states\n" +
  "    extend green\n" +
  "      accepting = true\n";
const drafted = draftMemberSize({
  block: baseBlock,
  sizeContainer: "sizes",
  name: "green",
  scale: 1.5,
  angle: 30,
  typeReference: "@node-sizes/specification/size_type",
});
check(
  "draftMemberSize appends the sizes section and the member when missing",
  drafted.includes("  extend sizes") &&
    drafted.includes("    green refines @node-sizes/specification/size_type") &&
    drafted.includes("      scale = 1.5") &&
    drafted.includes("      angle = 30"),
);
const redrafted = draftMemberSize({
  block: drafted,
  sizeContainer: "sizes",
  name: "green",
  scale: 2,
  angle: 45,
  typeReference: "@node-sizes/specification/size_type",
});
check(
  "draftMemberSize edits an existing entry in place (no duplicate member)",
  redrafted.split("    green refines").length === 2 &&
    redrafted.includes("      scale = 2") &&
    !redrafted.includes("      scale = 1.5"),
);

// the drafted source stages clean and survives a reload (re-staging)
const restaging = stage(redrafted, [], bedrock);
check("the drafted sizes block stages clean", restaging.verdicts.length === 0);

// ---- the ledger -------------------------------------------------------

console.log("node-sizes checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
