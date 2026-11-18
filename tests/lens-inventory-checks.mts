// L1 (issue #283): the lens/viewpoint inventory is DERIVED from the
// space, not hardcoded — a lens staged by the user appears in the
// picker without any code change, and buildWorkshopLook recognizes
// it. The notes are the layers' head comments, read as data.
//
//     node tests/lens-inventory-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import {
  displaySchemeLayers,
  isLensLayer,
  lensLayers,
  refinesClosure,
  viewNote,
  viewpointLayers,
} from "../src/presentation/viewTree.ts";
import { buildWorkshopLook } from "../src/presentation/lensDrawing.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the kernel ------------------------------------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources: Record<string, string> = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });
const bedrock = kernel.layerNames.map(String);

// ---- the derived inventory -------------------------------------------

const lenses = lensLayers({ space: kernel.space });
const viewpoints = viewpointLayers({ space: kernel.space });
const schemes = displaySchemeLayers({ space: kernel.space });

check(
  "the display schemes are exactly the display roots (graph-display)",
  schemes.length === 1 && schemes[0] === "graph-display",
);
check(
  "the kernel lenses are derived: the four display layers, in assembly order",
  ["graph-display", "petrinet-display", "kahn-display", "logic-circuit-display"].every((lens) =>
    lenses.includes(lens),
  ) &&
    lenses.every((lens, index) => {
      const assemblyIndex = bedrock.indexOf(lens);
      return index === 0 || bedrock.indexOf(lenses[index - 1]) < assemblyIndex;
    }),
);
check(
  "every derived lens has a display scheme in its refines closure",
  lenses.every((lens) =>
    refinesClosure({ space: kernel.space, layer: lens }).some((ancestor) => schemes.includes(ancestor)),
  ),
);
check(
  "the viewpoints are derived: the scheme and the four courses",
  ["view-scheme", "petrinet-view", "pn-philosophers-5-course", "kahn-course", "wb-course"].every(
    (viewpoint) => viewpoints.includes(viewpoint),
  ),
);
check(
  "the derivation is stable across calls",
  JSON.stringify(lensLayers({ space: kernel.space })) === JSON.stringify(lenses) &&
    JSON.stringify(viewpointLayers({ space: kernel.space })) === JSON.stringify(viewpoints),
);
check(
  "the note of a look is its head comment, read as data",
  viewNote({ space: kernel.space, layer: "graph-display" }).en.includes("generic lens") &&
    viewNote({ space: kernel.space, layer: "petrinet-display" }).en.includes("Petri lens"),
);

// ---- a user-staged lens appears without touching the code ------------

const modelDraft =
  "layer my-buchi refines @moore-traffic-light then @buchi-automaton\n" +
  "  extend states\n" +
  "    extend green\n" +
  "      accepting = true\n";
const lensDraft =
  "layer my-buchi-display refines @graph-display then @buchi-automaton\n" +
  "  extend specification\n" +
  "    extend state_type\n" +
  "      extend display when accepting\n" +
  "        glyphs\n" +
  "          ring1\n" +
  "            shape = \"circle\"\n" +
  "            fill = \"#ffffff\"\n" +
  "          ring2\n" +
  "            shape = \"circle\"\n";

const stage = (draftSource: string, previous: string[]) =>
  stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: previous,
    draftSource,
    livingLayerNames: [...bedrock, ...previous.map((source) => source.match(/layer (\S+)/)?.[1] ?? "")],
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

const lensStaging = stage(lensDraft, [modelDraft]);
check("the user lens draft is accepted", lensStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: lensStaging,
  knownLayerNames: [...bedrock, "my-buchi"],
  readonlyLayerNames: bedrock,
});

check(
  "the staged lens is recognized as a lens, without any code change",
  isLensLayer({ space: kernel.space, layer: "my-buchi-display" }) &&
    lensLayers({ space: kernel.space }).includes("my-buchi-display"),
);
const look = buildWorkshopLook({
  space: kernel.space,
  selectedView: "my-buchi-display",
  currentLayer: "my-buchi",
});
check(
  "buildWorkshopLook draws through the staged lens (isLens, 3 vertices)",
  look.isLens && look.lens === "my-buchi-display" && look.vertices.length === 3,
);

// ---- the ledger -------------------------------------------------------

console.log(
  "lens inventory checks: " + assertions + " assertions, " + failures.length + " failure(s)",
);
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
