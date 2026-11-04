// The living editor checks: a runtime-added layer re-enters the
// tribunal, is rewritten in place, and the write is declared —
// the touch protocol invalidates every memo entry that depends on
// the layer, its own and the children's (O18 through the
// refinement chain).
//
// Six scenarios over the assembled trunk corpus: a sound edition
// is accepted and applied (the new value crosses the diamond, the
// child's memo entry is invalidated and re-read), a broken syntax
// is refused and the space stays intact, an edition that betrays
// the declared expectation of ANOTHER living layer is refused as
// "attendu-trahi" and the space stays intact, a renamed layer is
// refused by the edition guard, a layer smuggled alongside the
// edition is refused too — and the touch is mandatory: without
// it, the memoized closure keeps serving the old refinement chain
// in silence.
//
//     node tests/editor-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { renderMessage } from "../src/domain/messages.ts";
import { stageLayerAddition, applyStagedAddition } from "../src/application/staging.ts";
import {
  stageLayerEdition,
  applyStagedEdition,
  type LivingAddition,
} from "../src/application/edition.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the assembled trunk and the living workshop --------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

/** The living workshop state, as the editor sees it: the accepted
 * additions, in order, and the layer names the space holds. */
const livingAdditions: LivingAddition[] = [];
const livingLayerNames: string[] = [...KERNEL_LAYER_NAMES];

/** Add a draft the way the ＋ composer does: stage, apply, keep. */
function addLayer({ draftSource }: { draftSource: string }) {
  const staging = stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: livingAdditions.map((addition) => addition.source),
    draftSource,
    livingLayerNames: [...livingLayerNames],
  });
  if (!staging.ok) throw new Error("the setup addition was refused: " + JSON.stringify(staging.verdicts));
  const applied = applyStagedAddition({
    space: kernel.space,
    staging,
    knownLayerNames: [...livingLayerNames],
  });
  livingAdditions.push({ source: draftSource.trim(), layerNames: [...applied.newLayerNames] });
  livingLayerNames.push(...applied.newLayerNames);
  return applied;
}

/** Edit a living layer the way the ✎ editor does: stage the edition
 * (the layer leaves the context, it is judged again). */
function editLayer({ layerName, editedSource }: { layerName: string; editedSource: string }) {
  return stageLayerEdition({
    languageSource: kernel.languageSource,
    livingAdditions,
    livingLayerNames: [...livingLayerNames],
    layerName: asLayerName(layerName),
    editedSource,
  });
}

// ---- the two living layers under edition ---------------------------

const parentSource = [
  "layer draft-demo refines @wb1",
  "  extend arcsAB",
  "    e3 refines @wb1/specification/arcAB_type",
  "      source = @wb1/left/a1",
  "      target = @wb1/right/b1",
].join("\n");
const childSource = [
  "layer draft-child refines @draft-demo",
  "  tests",
  "    expect arcsAB/e3/weight = 1",
].join("\n");

addLayer({ draftSource: parentSource });
addLayer({ draftSource: childSource });

// =====================================================================
// (a) a sound edition is accepted, applied, and the invalidation
//     is measured
// =====================================================================

// the closure of the edited layer is memoized first, plus a read at
// the child — both leave their memo entries in the space
const closureBefore = kernel.space.closure({
  layer: asLayerName("draft-demo"),
  path: asLayerPath([]),
});
const childWeightBefore = kernel.space.read({
  layer: asLayerName("draft-child"),
  path: asLayerPath(["arcsAB", "e3"]),
  key: "weight",
});
check(
  "(a) the child reads the inherited weight 1 before the edition (the diamond)",
  childWeightBefore === 1,
);
check("(a) no memo entry is stale before any edition", kernel.space.staleMemoKeys().length === 0);

// the edition widens the refinement chain: @kahn-scheme joins the closure
const widenedSource = parentSource.replace("refines @wb1", "refines @wb1 then @kahn-scheme");
const widened = editLayer({ layerName: "draft-demo", editedSource: widenedSource });
check(
  "(a) the sound edition is accepted: ok, no verdict, at the validation step",
  widened.ok === true &&
    widened.refusals.length === 0 &&
    widened.staging.verdicts.length === 0 &&
    widened.staging.step === "validation",
);

const edition = applyStagedEdition({
  space: kernel.space,
  layerName: asLayerName("draft-demo"),
  staging: widened.staging,
});
check(
  "(a) the applied edition reports the widened refinement targets",
  edition.refinementTargetsOf.join(",") === "wb1,kahn-scheme",
);
check(
  "(a) the applied edition carries the edited source block",
  (edition.block ?? "").includes("then @kahn-scheme"),
);

// the touch protocol: the edited layer's own entry AND the child's
// entry are invalidated (O18 through the refinement chain)
const stale = kernel.space.staleMemoKeys();
check(
  "(a) the touch invalidates the edited layer's own memo entry",
  stale.some((key) => key === "draft-demo|"),
);
check(
  "(a) the touch invalidates the CHILD layer's memo entry — the invalidation crosses the refinement chain (O18)",
  stale.some((key) => key === "draft-child|"),
);

// the re-read serves the living truth: the chain widened
const closureAfter = kernel.space.closure({
  layer: asLayerName("draft-demo"),
  path: asLayerPath([]),
});
check(
  "(a) the re-read closure serves the widened chain — kahn-scheme enters, the corpus stays frozen",
  closureAfter.some((address) => address[0] === "kahn-scheme") &&
    closureAfter.some((address) => address[0] === "wb1"),
);
const childWeightAfter = kernel.space.read({
  layer: asLayerName("draft-child"),
  path: asLayerPath(["arcsAB", "e3"]),
  key: "weight",
});
check(
  "(a) the re-read at the child still passes through the diamond — weight 1",
  childWeightAfter === 1,
);
check(
  "(a) the corpus layers never moved — the trunk stays intact under the living edition",
  [...KERNEL_LAYER_NAMES].every((name) => name in kernel.space.layers),
);

// =====================================================================
// (b) a broken syntax is refused, the space stays intact
// =====================================================================

const treeBefore = kernel.space.layers["draft-demo"];
const brokenEdition = editLayer({
  layerName: "draft-demo",
  editedSource: "layer draft-demo refines @wb1\n  extend arcsAB\n    e3 = oops \x1b[[",
});
check(
  "(b) the broken edition is refused at the syntax step, with readable errors",
  brokenEdition.ok === false &&
    brokenEdition.staging.step === "syntaxe" &&
    brokenEdition.staging.errors.length > 0,
);
check(
  "(b) the refused edition leaves the space intact — the tree is untouched",
  kernel.space.layers["draft-demo"] === treeBefore,
);

// =====================================================================
// (c) an edition that betrays another living layer's declared
//     expectation is refused — attendu-trahi, space intact
// =====================================================================

const betrayingSource = [
  "layer draft-demo refines @wb1",
  "  extend arcsAB",
  "    e3 refines @wb1/specification/arcAB_type",
  "      source = @wb1/left/a1",
  "      target = @wb1/right/b1",
  "      override weight = 7",
].join("\n");
const betraying = editLayer({ layerName: "draft-demo", editedSource: betrayingSource });
check(
  "(c) the betraying edition is refused at the validation step",
  betraying.ok === false && betraying.staging.step === "validation",
);
check(
  '(c) the betraying edition carries exactly the "attendu-trahi" verdict of the child layer',
  betraying.staging.verdicts.length === 1 &&
    betraying.staging.verdicts[0].kind === "attendu-trahi" &&
    renderMessage({ message: betraying.staging.verdicts[0].fact, language: "en" }).includes("draft-child"),
);
check(
  "(c) the refused betrayal leaves the space intact — the tree is untouched",
  kernel.space.layers["draft-demo"] === treeBefore,
);
check(
  "(c) the refused betrayal leaves the child's expectation standing — weight 1 still",
  kernel.space.read({
    layer: asLayerName("draft-child"),
    path: asLayerPath(["arcsAB", "e3"]),
    key: "weight",
  }) === 1,
);

// =====================================================================
// (d) a renamed layer is refused by the edition guard
// =====================================================================

// the kernel alone would accept the rename (no layer depends on
// draft-demo here — the child is context, its parent target
// stays), the edition guard refuses it: an edition edits, it
// never renames
const renamedSource = widenedSource.replace("layer draft-demo refines", "layer draft-renamed refines");
const renamed = editLayer({ layerName: "draft-demo", editedSource: renamedSource });
check(
  "(d) the renamed edition is refused by the edition guard — the name must stay",
  renamed.ok === false && renamed.refusals.includes("couche-renomme") === true,
);
check(
  "(d) the refused rename leaves the space intact — the tree is untouched",
  kernel.space.layers["draft-demo"] === treeBefore,
);

// =====================================================================
// (e) a layer smuggled alongside the edition is refused
// =====================================================================

const smuggledSource = widenedSource + "\n" + [
  "layer draft-smuggled refines @wb1",
  "  value = 1",
].join("\n");
const smuggled = editLayer({ layerName: "draft-demo", editedSource: smuggledSource });
check(
  "(e) the smuggled edition is refused — an edition is not an addition",
  smuggled.ok === false && smuggled.refusals.includes("couche-glissée") === true,
);
check(
  "(e) the refused smuggling leaves the space intact — no new layer entered",
  !("draft-smuggled" in kernel.space.layers) &&
    kernel.space.layers["draft-demo"] === treeBefore,
);

// =====================================================================
// (f) the touch is mandatory: without it, the memoized closure
//     serves the old chain in silence
// =====================================================================

const narrowedSource = parentSource; // back to @wb1 alone
const narrowed = editLayer({ layerName: "draft-demo", editedSource: narrowedSource });
check(
  "(f) the narrowing edition is accepted — the setup for the missing touch",
  narrowed.ok === true,
);

// replace the tree WITHOUT the touch: the write is not declared
kernel.space.layers["draft-demo"] = narrowed.staging.compiledLanguage!.layers["draft-demo"]!;
const closureWithoutTouch = kernel.space.closure({
  layer: asLayerName("draft-demo"),
  path: asLayerPath([]),
});
check(
  "(f) without the touch, the memoized closure serves the OLD chain — kahn-scheme stays visible",
  closureWithoutTouch.some((address) => address[0] === "kahn-scheme"),
);
check(
  "(f) without the touch, no entry reports itself stale — the staleness is silent",
  kernel.space.staleMemoKeys().length === 0,
);

// the declared write: the same replacement WITH the touch serves
// the living truth
kernel.space.touch({ layer: asLayerName("draft-demo"), path: asLayerPath([]) });
const closureWithTouch = kernel.space.closure({
  layer: asLayerName("draft-demo"),
  path: asLayerPath([]),
});
check(
  "(f) with the touch, the re-read closure serves the narrowed chain — kahn-scheme is gone",
  !closureWithTouch.some((address) => address[0] === "kahn-scheme"),
);

// =====================================================================
// the ledger
// =====================================================================

console.log("editor checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
