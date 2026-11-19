// The declared-labels study (issue #363, étage B) is document-only
// (docs/labels-study.md) — but its candidate micro-family is staged
// and JUDGED here, and the decisive subsumption scenario is pinned:
// label-timed-petrinet refines @label-petrinet, so its closure
// contains label-petrinet — a carrier wearing the specific label is
// found under the general one. The draft is NOT merged into the
// corpus: it lives in the study, judged here.
//
//     node tests/labels-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import { AddressView } from "../src/domain/addresses.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { refinesClosure } from "../src/presentation/viewTree.ts";

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

const stage = (draftSource: string, previous: string[], living: string[]) =>
  stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources: previous,
    draftSource,
    livingLayerNames: living,
    readonlyLayerNames: bedrock,
  });

// ---- the candidate: the label micro-family, staged and judged --------
// The exact draft of docs/labels-study.md's annexe.

const labelsDraft = [
  "layer label-scheme refines @record",
  "  abstract label",
  "",
  "layer label-petrinet refines @label-scheme",
  '  override label = "petrinet"',
  "",
  "layer label-timed-petrinet refines @label-petrinet",
  '  override label = "timed-petrinet"',
  "",
  "layer label-statespace refines @label-scheme",
  '  override label = "statespace"',
  "",
  "layer pn-philosophers-5-labelled refines @pn-philosophers-5",
  "  labels refines @collection",
  "    extend specification",
  "      extend collection",
  "        override type = @label-scheme",
  "    petrinet = @label-petrinet",
  "    timed = @label-timed-petrinet",
  "  extend tests",
  "    expect labels/petrinet = @label-petrinet",
  "    expect labels/timed = @label-timed-petrinet",
  "",
].join("\n");

const labelsStaging = stage(labelsDraft, [], bedrock);
check(
  "the label-scheme draft (study annexe) is accepted by the staging — 0 verdicts, not merged",
  labelsStaging.verdicts.length === 0,
);
applyStagedAddition({
  space: kernel.space,
  staging: labelsStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

// ---- the decisive scenario: subsumption by refinement ----------------

check(
  "subsumption by closure: label-timed-petrinet's refines closure contains label-petrinet (a carrier of the specific is found under the general)",
  refinesClosure({ space: kernel.space, layer: "label-timed-petrinet" }).includes("label-petrinet") &&
    refinesClosure({ space: kernel.space, layer: "label-petrinet" }).includes("label-scheme"),
);
check(
  "the labels are addressable: the carrier's labels read as LRefs, each label layer carries its slot",
  (() => {
    const petrinet = kernel.space.read({
      layer: asLayerName("pn-philosophers-5-labelled"),
      path: asLayerPath(["labels"]),
      key: "petrinet",
    });
    const timed = kernel.space.read({
      layer: asLayerName("pn-philosophers-5-labelled"),
      path: asLayerPath(["labels"]),
      key: "timed",
    });
    const labelSlot = kernel.space.read({
      layer: asLayerName("label-petrinet"),
      path: asLayerPath([]),
      key: "label",
    });
    return (
      petrinet instanceof AddressView &&
      petrinet.layer === "label-petrinet" &&
      timed instanceof AddressView &&
      timed.layer === "label-timed-petrinet" &&
      labelSlot === "petrinet"
    );
  })(),
);
// ---- the ledger -------------------------------------------------------

console.log(
  "labels checks: " + assertions + " assertions, " + failures.length + " failure(s)",
);
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
