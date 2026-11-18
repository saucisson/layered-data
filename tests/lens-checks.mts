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
  glyphShapeVerdict,
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

// a child `glyphs` block overrides the parent's block WHOLE (nearest
// defining source wins — not the oldest ancestor)
const childGlyphsDraft =
  "layer child-display refines @automaton-display\n" +
  "  extend specification\n" +
  "    extend state_type\n" +
  "      extend display when accepting\n" +
  "        override glyphs\n" +
  "          only\n" +
  "            shape = \"rectangle\"\n" +
  "            w = 30\n";
const childStaging = stage(childGlyphsDraft, [modelDraft]);
check("the child glyphs-block draft is accepted", childStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: childStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});
const childTemplate = readDisplayTemplate({
  space: kernel.space,
  lens: asLayerName("child-display"),
  path: asLayerPath(["specification", "state_type"]),
});
check(
  "a child glyphs block wins whole over the parent's block (nearest source)",
  childTemplate !== null &&
    childTemplate.length === 1 &&
    childTemplate[0]?.shape === "rectangle" &&
    (childTemplate[0] as { w?: number }).w === 30,
);

// ---- the verdict helper and the narrowing edges -----------------------

check(
  "glyphShapeVerdict names the fault (unknown shape, invalid path, valid, non-dictionary)",
  glyphShapeVerdict({ shape: "double-circle" }) === "forme-inconnue" &&
    glyphShapeVerdict({ shape: "path", d: "M0,0 <b>" }) === "tracé-invalide" &&
    glyphShapeVerdict({ shape: "circle" }) === null &&
    glyphShapeVerdict("nope") === "forme-inconnue" &&
    glyphShapeVerdict({ shape: "path", d: "M0,0 L1,1 Z" }) === null,
);
check(
  "the path grammar refuses glued numbers and trailing dots, accepts exponents and leading dots",
  !isValidPathData("M1.2.3 L0,0") &&
    !isValidPathData("M5. L0,0") &&
    isValidPathData("M1e3,0 L.5,2 Z") &&
    !isValidPathData("M0,0 L10,10 <script>"),
);
const ellipseGlyph = asGlyph({ shape: "ellipse", rx: 30, ry: 10 });
const lineGlyph = asGlyph({ shape: "line", dash: true, curve: "bezier", arrow: "vee" });
const badR = asGlyph({ shape: "circle", r: "big", "label-side": "diagonal" });
const badSide = asGlyph({ shape: "circle", r: 5, "label-side": "diagonal" });
const badCurve = asGlyph({ shape: "line", curve: "spiral" });
check(
  "asGlyph narrows every genre's fields and ignores invalid ones",
  ellipseGlyph?.shape === "ellipse" &&
    (ellipseGlyph as { rx?: number }).rx === 30 &&
    (asGlyph({ shape: "box", w: 60, h: 20 }) as { h?: number } | null)?.h === 20 &&
    lineGlyph?.shape === "line" &&
    (lineGlyph as { curve?: string }).curve === "bezier" &&
    (badR as { r?: number } | null)?.r === undefined &&
    (badSide as { "label-side"?: string } | null)?.["label-side"] === undefined &&
    (badCurve as { curve?: string } | null)?.curve === undefined &&
    asGlyph({ shape: "triangle" }) === null &&
    asGlyph(42) === null,
);
check(
  "labelPosition covers the four sides and the label-dx/dy offset",
  labelPosition({ glyph: asGlyph({ shape: "circle", r: 20, "label-side": "south" })!, x: 0, y: 0 }).y === 29 &&
    labelPosition({ glyph: asGlyph({ shape: "circle", r: 20, "label-side": "east" })!, x: 0, y: 0 })
      .textAnchor === "start" &&
    labelPosition({ glyph: asGlyph({ shape: "circle", r: 20, "label-side": "west" })!, x: 0, y: 0 })
      .textAnchor === "end" &&
    labelPosition({ glyph: asGlyph({ shape: "circle", "label-dx": 4, "label-dy": -2 })!, x: 10, y: 10 })
      .x === 14 &&
    labelPosition({ glyph: asGlyph({ shape: "circle", "label-dx": 4, "label-dy": -2 })!, x: 10, y: 10 })
      .y === 11,
);
check(
  "glyphBounds covers ellipse, path and the line fallback",
  glyphBounds(asGlyph({ shape: "ellipse", rx: 30, ry: 10 })!).x1 === 30 &&
    glyphBounds(asGlyph({ shape: "path", d: "M-5,-5 L10,20 Z" })!).x1 === 10 &&
    glyphBounds(asGlyph({ shape: "path", d: "M0,0 Z" })!).x1 === 0 &&
    glyphBounds(asGlyph({ shape: "line" })!).x1 === 16,
);
check(
  "a bezier arc with fewer than 3 points falls back to the polyline",
  !arcPathData({ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], curve: "bezier" }).includes("C"),
);

// ---- L7: the corrected orphan stages clean -----------------------------

// formalisms/kernel/buchi-traffic-light.ld as it stands is refused
// (surcharge-implicite x2 + attendu-trahi on states/green/acceptance).
// The corrected draft — extend instead of refines, extend tests, no
// expect on the acceptance slot that reads null — must stage with
// zero verdicts. The fix-vs-delete decision is the maintainer's (#289).
const orphanDraft =
  "layer buchi-traffic-light refines @moore-traffic-light then @buchi-automaton\n" +
  "  extend states\n" +
  "    extend green\n" +
  "      accepting = true\n" +
  "  extend tests\n" +
  "    expect states/green/accepting = true\n" +
  "    expect states/red/accepting absent\n" +
  "    expect states/amber/accepting absent\n" +
  "    expect states/green/output = \"go\"\n";
const orphanStaging = stage(orphanDraft, []);
check(
  "the corrected buchi-traffic-light draft stages with zero verdicts",
  orphanStaging.verdicts.length === 0,
);

// ---- the ledger -------------------------------------------------------

console.log("lens checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
