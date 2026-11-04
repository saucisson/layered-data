// The staging protocol checks: the composer never dies of a typo,
// the living space never absorbs a refused draft.
//
// Four scenarios over the assembled trunk corpus: a sound draft is
// accepted and applied (its layers enter the living space, its
// refinement targets are reported), a broken syntax is refused at
// the syntax step, an unknown refinement target is refused as
// "cible-inconnue", and a betrayed expectation is refused as
// "attendu-trahi". The verdict kinds are part of the observable
// contract — they are frozen exactly as the kernel statuses are.
//
//     node tests/staging-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { stageLayerAddition, applyStagedAddition } from "../src/application/staging.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the assembled trunk ---------------------------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

function stage({ draftSource, previousAdditionSources = [] }: { draftSource: string; previousAdditionSources?: string[] }) {
  return stageLayerAddition({
    languageSource: kernel.languageSource,
    previousAdditionSources,
    draftSource,
    livingLayerNames: [...KERNEL_LAYER_NAMES],
  });
}

// =====================================================================
// (a) a sound draft is accepted and applied
// =====================================================================

const soundDraft = [
  "layer draft-demo refines @wb1",
  "  extend arcsAB",
  "    e3 refines @wb1/specification/arcAB_type",
  "      source = @wb1/left/a1",
  "      target = @wb1/right/b1",
  "  tests",
  "    expect arcsAB/e3/weight = 1",
].join("\n");

const accepted = stage({ draftSource: soundDraft });
check(
  "(a) the sound draft is accepted: ok, no verdict, at the validation step",
  accepted.ok === true && accepted.verdicts.length === 0 && accepted.step === "validation",
);
check(
  "(a) the staged outcome declares exactly the draft layer",
  accepted.layerNames.includes(asLayerName("draft-demo")),
);
check(
  "(a) the staged outcome blocks the draft layer text for the wardrobe",
  (accepted.blocks["draft-demo"] ?? "").includes("layer draft-demo refines @wb1"),
);

const applied = applyStagedAddition({ space: kernel.space, staging: accepted, knownLayerNames: KERNEL_LAYER_NAMES });
check(
  "(a) the applied addition registers exactly the new layer",
  applied.newLayerNames.length === 1 && applied.newLayerNames.includes(asLayerName("draft-demo")),
);
check(
  "(a) the applied addition reports the refinement target of the new layer",
  applied.refinementTargetsOf["draft-demo"].join(",") === "wb1",
);
check(
  "(a) the new layer is readable in the living space — the inherited weight crosses the diamond",
  kernel.space.read({ layer: asLayerName("draft-demo"), path: asLayerPath(["arcsAB", "e3"]), key: "weight" }) === 1,
);

// a second staging over the same living space still accepts the
// already-applied draft: it is known, not re-judged
const reStaged = stage({ draftSource: soundDraft });
check(
  "(a) re-staging an already-applied draft stays sound (known layers are not re-judged)",
  reStaged.ok === true && reStaged.verdicts.length === 0,
);

// =====================================================================
// (b) a broken syntax is refused at the syntax step
// =====================================================================

const brokenDraft = "layer draft-broken refines @wb1\n  extend arcsAB\n    e3 = oops \x1b[[";
const refusedSyntax = stage({ draftSource: brokenDraft });
check(
  "(b) the broken draft is refused at the syntax step, with readable errors",
  refusedSyntax.ok === false &&
    refusedSyntax.step === "syntaxe" &&
    refusedSyntax.errors.length > 0 &&
    refusedSyntax.compiledLanguage === null,
);

// =====================================================================
// (c) an unknown refinement target is refused as cible-inconnue
// =====================================================================

const orphanDraft = "layer draft-orphan refines @unknown-layer\n  value = 1\n";
const refusedOrphan = stage({ draftSource: orphanDraft });
check(
  "(c) the orphan target is refused at the validation step",
  refusedOrphan.ok === false && refusedOrphan.step === "validation",
);
check(
  '(c) the orphan target carries exactly the "cible-inconnue" verdict',
  refusedOrphan.verdicts.length === 1 && refusedOrphan.verdicts[0].kind === "cible-inconnue",
);

// =====================================================================
// (d) a betrayed expectation is refused as attendu-trahi
// =====================================================================

const betrayedDraft = [
  "layer draft-betrayer refines @wb1",
  "  tests",
  "    expect arcsAB/e1/weight = 999",
].join("\n");
const refusedBetrayed = stage({ draftSource: betrayedDraft });
check(
  "(d) the betrayed expectation is refused at the validation step",
  refusedBetrayed.ok === false && refusedBetrayed.step === "validation",
);
check(
  '(d) the betrayed expectation carries exactly the "attendu-trahi" verdict',
  refusedBetrayed.verdicts.length === 1 && refusedBetrayed.verdicts[0].kind === "attendu-trahi",
);

// =====================================================================
// the ledger
// =====================================================================

console.log("staging checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
