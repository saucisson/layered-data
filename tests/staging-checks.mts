// The staging protocol checks: the composer never dies of a typo,
// the living space never absorbs a refused draft.
//
// Nine scenarios over the assembled bedrock corpus: a sound draft is
// accepted and applied (its layers enter the living space, its
// refinement targets are reported), a broken syntax is refused at
// the syntax step, an unknown refinement target is refused as
// "cible-inconnue", a betrayed expectation is refused as
// "attendu-trahi", an order conflict is accepted
// permissively but refused as "conflit-d'ordre" in strict mode,
// without exception (ADR-0100, retired as a semantics by ADR-0106),
// the retired words fall back to the common vocabulary of keys
// (ADR-0106), a check posed without
// its slots is refused as "check-vacant" (ADR-0101), and a cyclic
// candidate over the dag family is accepted permissively but its
// carried check refuses it as "check-trahi" in strict mode. The
// verdict kinds are part of the observable contract — they are
// frozen exactly as the kernel statuses are.
//
//     node tests/staging-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { stageLayerAddition, applyStagedAddition } from "../src/application/staging.ts";
import { runAllLints } from "../src/application/linting.ts";
import { Space } from "../src/domain/space.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the assembled bedrock ---------------------------------------------

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
    readonlyLayerNames: [...KERNEL_LAYER_NAMES],
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
  "(a) the staged outcome blocks the draft layer text for the quarry",
  (accepted.blocks["draft-demo"] ?? "").includes("layer draft-demo refines @wb1"),
);

const applied = applyStagedAddition({ space: kernel.space, staging: accepted, knownLayerNames: KERNEL_LAYER_NAMES, readonlyLayerNames: KERNEL_LAYER_NAMES });
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
// (e) an order conflict: permissive staging accepts, the strict
// mode refuses as conflit-d'ordre, without exception (ADR-0106) —
// and inheritance alone never conflicts: the sound draft stays
// accepted in strict mode
// =====================================================================

// two incomparable providers of the same leaf key: the draft layer
// refines both branches, the refines ORDER alone decides who wins
const conflictDraft = [
  "layer demo-left refines @record",
  "  charge = 1",
  "layer demo-right refines @record",
  "  charge = 2",
  "layer demo-conflict refines @demo-left then @demo-right",
].join("\n");

const permissiveConflict = stage({ draftSource: conflictDraft });
check(
  "(e) the conflict is accepted by the permissive staging — the lint's inventory is the whole story",
  permissiveConflict.ok === true && permissiveConflict.verdicts.length === 0,
);
check(
  "(e) the permissive winner is measured: first-wins walked the branches as written",
  permissiveConflict.ok &&
    permissiveConflict.compiledLanguage !== null &&
    new Space(permissiveConflict.compiledLanguage.layers).read({
      layer: asLayerName("demo-conflict"),
      path: asLayerPath([]),
      key: "charge",
    }) === 1,
);

const strictSound = stageLayerAddition({
  languageSource: kernel.languageSource,
  previousAdditionSources: [],
  draftSource: soundDraft,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  strictConflicts: true,
});
check(
  "(e) the sound draft stays accepted in strict mode — vertical inheritance is never a conflict",
  strictSound.ok === true && strictSound.verdicts.length === 0,
);

const strictConflict = stageLayerAddition({
  languageSource: kernel.languageSource,
  previousAdditionSources: [],
  draftSource: conflictDraft,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  strictConflicts: true,
});
check(
  "(e) the conflict is refused in strict mode, at the validation step — without exception",
  strictConflict.ok === false && strictConflict.step === "validation",
);
check(
  '(e) the conflict carries exactly the "conflit-d\'ordre" verdict',
  strictConflict.verdicts.length === 1 && strictConflict.verdicts[0].kind === "conflit-d'ordre",
);
check(
  "(e) the conflict verdict names the winner, the loser and the key",
  strictConflict.verdicts.length === 1 &&
    JSON.stringify(strictConflict.verdicts[0].fact.params).includes("charge") &&
    JSON.stringify(strictConflict.verdicts[0].fact.params).includes("demo-left") &&
    JSON.stringify(strictConflict.verdicts[0].fact.params).includes("demo-right"),
);

// =====================================================================
// (f) the retired words fall back to the common vocabulary of keys
// (ADR-0106): `mask` and `assume` are no longer acts of the grammar
// — written as members, they are ordinary data, declared and read
// like any key. The door is closed, not welded.
// =====================================================================

const retiredDraft = [
  "layer demo-retired refines @record",
  "  assume = 7",
  "  mask = 3",
].join("\n");

const retiredStage = stage({ draftSource: retiredDraft });
check(
  "(f) the retired words parse as ordinary members — nothing reserves them anymore",
  retiredStage.ok === true && retiredStage.verdicts.length === 0,
);
check(
  "(f) the retired words are measured: both members read their laid values",
  retiredStage.ok &&
    retiredStage.compiledLanguage !== null &&
    new Space(retiredStage.compiledLanguage.layers).read({ layer: asLayerName("demo-retired"), path: asLayerPath([]), key: "assume" }) === 7 &&
    new Space(retiredStage.compiledLanguage.layers).read({ layer: asLayerName("demo-retired"), path: asLayerPath([]), key: "mask" }) === 3,
);

// =====================================================================
// (g) nothing signs a conflict anymore (ADR-0106): the lint
// inventories the whole of it — conflit-d'ordre is a diagnostic, the
// strict staging a verdict, and no act silences either
// =====================================================================

// the lint inventories the conflicts and respects nothing — every
// crossing is recorded, the diagnostics channel hides none
const conflictLints = runAllLints({
  space: new Space(permissiveConflict.compiledLanguage!.layers),
  layerNames: permissiveConflict.layerNames,
  compilation: permissiveConflict.compiledLanguage!,
});
check(
  "(g) the lint records the conflict as a conflit-d'ordre diagnostic",
  conflictLints.some(
    (diagnostic) =>
      diagnostic.kind === "conflit-d'ordre" &&
      diagnostic.address[0] === "demo-conflict" &&
      JSON.stringify(diagnostic.fact.params).includes("charge"),
  ),
);

// =====================================================================
// (h) a check posed without its slots is refused as check-vacant —
// the constraint carried but unable to judge (ADR-0101); the lint
// inventories the same vacancy as a diagnostic
// =====================================================================

// a layer poses the k-partite constraint but binds nothing: the check
// cannot judge — its built-in contract requires the vertices/edges slots
const vacantDraft = [
  "layer demo-vacant refines @record",
  "  check k-partite",
].join("\n");
const refusedVacant = stage({ draftSource: vacantDraft });
check(
  "(h) the posed check without slots is refused at the validation step",
  refusedVacant.ok === false && refusedVacant.step === "validation",
);
check(
  '(h) the vacant pose carries the "check-vacant" verdicts, one per required slot, naming the tag',
  refusedVacant.verdicts.length === 4 &&
    refusedVacant.verdicts.every((verdict) => verdict.kind === "check-vacant") &&
    refusedVacant.verdicts.every((verdict) =>
      JSON.stringify(verdict.fact.params).includes("k-partite"),
    ) &&
    refusedVacant.verdicts.some((verdict) =>
      JSON.stringify(verdict.fact.params).includes("edges"),
    ),
);
// the same vacancy, seen by the lint — the diagnostics fold
check(
  "(h) the lint inventories the vacancy too — the detector sees, the validation judges",
  refusedVacant.ok === false &&
    refusedVacant.compiledLanguage !== null &&
    runAllLints({
      space: new Space(refusedVacant.compiledLanguage.layers),
      layerNames: refusedVacant.layerNames,
      compilation: refusedVacant.compiledLanguage,
    }).some((diagnostic) => diagnostic.kind === "check-vacant"),
);

// =====================================================================
// (i) the carried checks finally execute in strict mode (ADR-0101):
// a cyclic candidate over the dag family is accepted permissively,
// refused as "check-trahi" when the strict arm executes the checks
// =====================================================================

// three arcs in a cycle, refining the dag family's own edge type —
// the check dag is carried by the type, its slots bound by the
// family (multidigraph); only the execution can see the cycle
const cyclicDraft = [
  "layer demo-cycle refines @dag",
  "  extend vertices",
  "    v1 refines @multidigraph/edge_type",
  "      identifier = 1",
  "    v2 refines @multidigraph/edge_type",
  "      identifier = 2",
  "    v3 refines @multidigraph/edge_type",
  "      identifier = 3",
  "  extend edges",
  "    a1 refines @dag/edge_type",
  "      source = @demo-cycle/vertices/v1",
  "      target = @demo-cycle/vertices/v2",
  "    a2 refines @dag/edge_type",
  "      source = @demo-cycle/vertices/v2",
  "      target = @demo-cycle/vertices/v3",
  "    a3 refines @dag/edge_type",
  "      source = @demo-cycle/vertices/v3",
  "      target = @demo-cycle/vertices/v1",
].join("\n");

const permissiveCycle = stage({ draftSource: cyclicDraft });
check(
  "(i) the cyclic candidate is accepted permissively — the workshop stays immutable, the constraint decorative",
  permissiveCycle.ok === true && permissiveCycle.verdicts.length === 0,
);

const strictCycle = stageLayerAddition({
  languageSource: kernel.languageSource,
  previousAdditionSources: [],
  draftSource: cyclicDraft,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  strictChecks: true,
});
check(
  "(i) the strict arm executes the carried checks — the cycle is refused",
  strictCycle.ok === false && strictCycle.step === "validation",
);
check(
  '(i) each cyclic arc carries its "check-trahi" verdict, the carried check refusing',
  strictCycle.verdicts.length === 3 &&
    strictCycle.verdicts.every((verdict) => verdict.kind === "check-trahi") &&
    strictCycle.verdicts.every((verdict) => JSON.stringify(verdict.fact.params).includes("cycle")),
);
check(
  "(i) the refusal names the judging address — the arc the check refused at",
  strictCycle.verdicts.length === 3 &&
    strictCycle.verdicts.every((verdict) =>
      JSON.stringify(verdict.fact.params).includes("demo-cycle::edges/"),
    ),
);

// =====================================================================
// (j) the bedrock is read-only BY PROTOCOL (ADR-0103): a draft that
//     claims a bedrock name is refused as socle-occupé — the theft
//     named, the forgery never judged
// =====================================================================

const bedrockDraft = 'layer record\n  specification\n    record = "volé"\n';
const refusedBedrock = stage({ draftSource: bedrockDraft });
check(
  '(j) the draft claiming a bedrock name is refused at the validation step',
  refusedBedrock.ok === false && refusedBedrock.step === "validation",
);
check(
  '(j) the refusal carries exactly the "socle-occupé" verdict — the theft named, never the forgery judged (measured before ADR-0103: 13 ghost declarations accusing innocent layers)',
  refusedBedrock.verdicts.length === 1 && refusedBedrock.verdicts[0].kind === "socle-occupé",
);
check(
  '(j) the refused staging compiles nothing — the token space of a forgery never leaves the staging',
  refusedBedrock.compiledLanguage === null,
);
check(
  '(j) a draft that REFINES a bedrock layer stays welcome — the bedrock is read-only, not refinement-proof',
  stage({ draftSource: "layer draft-welcome refines @record\n" }).ok === true,
);
check(
  '(j) the act of addition itself never writes a readonly name — the route refuses, whoever calls it',
  applyStagedAddition({
    space: kernel.space,
    staging: accepted,
    knownLayerNames: [...KERNEL_LAYER_NAMES],
    readonlyLayerNames: [asLayerName("draft-demo")],
  }).newLayerNames.length === 0,
);

// =====================================================================
// the ledger
// =====================================================================

console.log("staging checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
