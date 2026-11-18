// L2 + L5 (issues #284, #287): the parametric glyph vocabulary
// (dimensions, path genre, declared label placement, bezier arcs),
// the automaton-display proof lens (double circle on accepting
// states), and the end of the silence — unknown shapes and
// out-of-grammar paths are staging verdicts, a partial override
// inherits the parent's fields.
//
//     node tests/lens-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import {
  asGlyph,
  drawnShape,
  isValidPathData,
  readDisplayTemplate,
} from "../src/domain/views.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { isLensLayer, lensLayers } from "../src/presentation/viewTree.ts";
import { buildWorkshopLook } from "../src/presentation/lensDrawing.ts";
import { arcPathData, glyphBounds, labelPosition } from "../src/presentation/glyphGeometry.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the kernel (89 layers, automaton-display included) -------------

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
  "automaton-display is a derived lens of the kernel",
  lensLayers({ space: kernel.space }).includes("automaton-display") &&
    isLensLayer({ space: kernel.space, layer: "automaton-display" }),
);
check(
  "the pristine kernel carries no display verdict (validation green)",
  kernel.validation.verdicts.length === 0,
);

// ---- the Büchi model + the double circle ----------------------------

const modelDraft =
  "layer my-buchi refines @moore-traffic-light then @buchi-automaton\n" +
  "  extend states\n" +
  "    extend green\n" +
  "      accepting = true\n";
const stage = (draftSource: string, previous: string[]) =>
  stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: previous,
    draftSource,
    livingLayerNames: bedrock,
    readonlyLayerNames: bedrock,
  });
const modelStaging = stage(modelDraft, []);
check("the Büchi model draft is accepted", modelStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: modelStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

const accepting = drawnShape({
  space: kernel.space,
  lens: asLayerName("automaton-display"),
  layer: asLayerName("my-buchi"),
  path: asLayerPath(["states", "green"]),
});
const ordinary = drawnShape({
  space: kernel.space,
  lens: asLayerName("automaton-display"),
  layer: asLayerName("my-buchi"),
  path: asLayerPath(["states", "red"]),
});
check(
  "the accepting state wears the double circle (two circles, distinct radii)",
  accepting !== null &&
    accepting.guarded &&
    accepting.spec.length === 2 &&
    accepting.spec.every((glyph) => glyph.shape === "circle") &&
    (accepting.spec[0] as { r?: number }).r !== (accepting.spec[1] as { r?: number }).r,
);
check(
  "the ordinary state keeps the single inherited circle",
  ordinary !== null && !ordinary.guarded && ordinary.spec.length === 1 && ordinary.spec[0]?.shape === "circle",
);
const look = buildWorkshopLook({
  space: kernel.space,
  selectedView: "automaton-display",
  currentLayer: "my-buchi",
});
check(
  "buildWorkshopLook draws through automaton-display (isLens, 3 vertices)",
  look.isLens && look.vertices.length === 3,
);

// ---- the vocabulary narrowing ----------------------------------------

const parametric = asGlyph({ shape: "circle", r: 11, dash: true, angle: 45, "label-side": "north" });
check(
  "asGlyph keeps the parametric fields (r, dash, angle, label-side)",
  parametric !== null &&
    parametric.shape === "circle" &&
    parametric.r === 11 &&
    parametric.dash === true &&
    parametric.angle === 45 &&
    parametric["label-side"] === "north",
);
check(
  "asGlyph reads the path genre (d kept), drops a path without d",
  asGlyph({ shape: "path", d: "M0,0 L10,10 Z" })?.shape === "path" &&
    asGlyph({ shape: "path" }) === null,
);
check(
  "the path grammar accepts commands/numbers/separators only",
  isValidPathData("M0,0 L10 10 C1,2 3,4 5,6 S7,8 9,10 Q1,1 2,2 T3,3 A4,4 0 0 1 5,5 H6 V7 Z") &&
    !isValidPathData("M0,0 L10,10 <script>") &&
    !isValidPathData("M0,0 x10,10") &&
    !isValidPathData(""),
);

// ---- the declared label placement ------------------------------------

const circle = asGlyph({ shape: "circle", r: 20 })!;
check(
  "label-side inside keeps the historical placement",
  labelPosition({ glyph: circle, x: 100, y: 50 }).y === 53,
);
const north = asGlyph({ shape: "circle", r: 20, "label-side": "north" })!;
check(
  "label-side north places the label on the bounds",
  labelPosition({ glyph: north, x: 100, y: 50 }).y === 50 - 20 - 3,
);
check(
  "glyphBounds follows the dimensions",
  glyphBounds(circle).x1 === 20 && glyphBounds(asGlyph({ shape: "rectangle", w: 60, h: 30 })!).x1 === 30,
);

// ---- the bezier arc ---------------------------------------------------

check(
  "curve bezier emits cubic segments through the waypoints, polyline stays M/L",
  arcPathData({ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }], curve: "bezier" }).includes("C") &&
    !arcPathData({ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }], curve: "polyline" }).includes("C"),
);

// ---- L5: the end of the silence ---------------------------------------

const unknownShapeDraft =
  "layer my-buchi-display-v2 refines @graph-display then @buchi-automaton\n" +
  "  extend specification\n" +
  "    extend state_type\n" +
  "      extend display when accepting\n" +
  "        override shape = \"double-circle\"\n";
const unknownStaging = stage(unknownShapeDraft, [modelDraft]);
check(
  "an unknown shape is a forme-inconnue verdict at staging",
  unknownStaging.verdicts.some((verdict) => verdict.kind === "forme-inconnue"),
);

const badPathDraft =
  "layer my-path-display refines @graph-display then @buchi-automaton\n" +
  "  extend specification\n" +
  "    extend state_type\n" +
  "      extend display\n" +
  "        override shape = \"path\"\n" +
  "        override d = \"M0,0 L10,10 <b>\"\n";
const badPathStaging = stage(badPathDraft, [modelDraft]);
check(
  "an out-of-grammar d is a tracé-invalide verdict at staging",
  badPathStaging.verdicts.some((verdict) => verdict.kind === "tracé-invalide"),
);

// a partial override inherits the parent's fields (no more empty glyph)
const partial = readDisplayTemplate({
  space: kernel.space,
  lens: asLayerName("petrinet-display"),
  path: asLayerPath(["specification", "place_type"]),
});
check(
  "readDisplayTemplate merges field by field (place_type keeps its ellipse shape)",
  partial !== null && partial.length === 1 && partial[0]?.shape === "ellipse",
);

// ---- the ledger -------------------------------------------------------

console.log("lens checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
