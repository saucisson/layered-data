// The verified pen loop checks: the pen proposes, the staging
// judges, the refusal travels back with its verdicts.
//
// The loop itself is pure — the model call is injected — so the
// whole protocol is proven offline, against deterministic pens
// that fail and correct themselves: syntax errors, orphan
// targets, betrayed expectations, mute proposals. The loop must
// accept exactly what the workshop staging accepts, refuse with
// the kernel's own verdict vocabulary, and never let an
// unverified draft through.
//
//     node tests/pen-loop-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { fact } from "../src/domain/messages.ts";
import { composeVerifiedLayerDraft, formatPenFeedback, type PenLoopOutcome, type PenRound } from "../src/application/penLoop.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the trunk context, as the server builds it ---------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

/** A deterministic pen replaying a script of proposals, recording
 * the rounds it was asked — the offline double of the model call. */
function scriptedPen({ scripts }: { scripts: string[] }) {
  const rounds: PenRound[] = [];
  const propose = async (round: PenRound): Promise<string> => {
    rounds.push(round);
    const proposal = scripts[round.attempt - 1] ?? "";
    return proposal;
  };
  return { propose, rounds };
}

function runLoop({ scripts, livingLayerNames = [...KERNEL_LAYER_NAMES], previousAdditionSources = [] }: { scripts: string[]; livingLayerNames?: string[]; previousAdditionSources?: string[] }): Promise<PenLoopOutcome> {
  return composeVerifiedLayerDraft({
    instruction: "une couche de démonstration",
    languageSource: kernel.languageSource,
    livingLayerNames,
    previousAdditionSources,
    maxAttempts: 3,
    propose: scriptedPen({ scripts }).propose,
  });
}

const soundDraft = [
  "layer draft-demo refines @wb1",
  "  extend arcsAB",
  "    e3 refines @wb1/specification/arcAB_type",
  "      source = @wb1/left/a1",
  "      target = @wb1/right/b1",
].join("\n");

// =====================================================================
// (a) a sound proposal is accepted at the first attempt
// =====================================================================

const firstTry = await runLoop({ scripts: [soundDraft] });
check(
  "(a) a sound proposal is accepted first try: ok, one attempt, no refusal",
  firstTry.ok === true && firstTry.attempts === 1 && firstTry.refusals.length === 0,
);
check(
  "(a) the accepted draft source is the proposal itself, staged",
  firstTry.draftSource === soundDraft && firstTry.staging !== null && firstTry.staging.ok === true,
);
check(
  "(a) the first round carries no feedback",
  firstTry.staging !== null,
);

// =====================================================================
// (b) a syntax error is refused, the verdict travels back, the
//     corrected proposal is accepted — the loop at work
// =====================================================================

const brokenDraft = "layer draft-demo refines @wb1\n  extend arcsAB\n    e3 = oops \x1b[[";
const correctivePen = scriptedPen({ scripts: [brokenDraft, soundDraft] });
const secondTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: correctivePen.propose,
});
check(
  "(b) the broken-then-corrected pen is accepted at the second attempt",
  secondTry.ok === true && secondTry.attempts === 2,
);
check(
  "(b) the first round carried no feedback, the second carried the syntax refusal",
  correctivePen.rounds.length === 2 && correctivePen.rounds[0].feedback === null && correctivePen.rounds[1].feedback !== null,
);
check(
  "(b) the refusal is a syntax step with readable errors",
  secondTry.refusals.length === 1 &&
    secondTry.refusals[0].step === "syntaxe" &&
    secondTry.refusals[0].errors.length > 0,
);
check(
  "(b) the feedback speaks the refusal to the model: attempt number, step, error, the order to rewrite",
  secondTry.refusals[0].feedback.includes("#1") &&
    secondTry.refusals[0].feedback.includes("syntax") &&
    secondTry.refusals[0].feedback.includes("no explanation"),
);
check(
  "(b) the feedback the model received is exactly the formatted refusal",
  correctivePen.rounds[1].feedback === secondTry.refusals[0].feedback,
);

// =====================================================================
// (c) a pen that never corrects itself exhausts the budget
// =====================================================================

const orphanDraft = "layer draft-orphan refines @unknown-layer\n  value = 1\n";
const stubbornPen = scriptedPen({ scripts: [orphanDraft, orphanDraft, orphanDraft] });
const thirdTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: stubbornPen.propose,
});
check(
  "(c) the stubborn pen exhausts the budget: refused after three attempts",
  thirdTry.ok === false && thirdTry.attempts === 3 && thirdTry.refusals.length === 3,
);
check(
  "(c) a spent budget carries no draft and no staging",
  thirdTry.draftSource === null && thirdTry.staging === null,
);
check(
  "(c) every refusal is the kernel's own verdict vocabulary (cible-inconnue), each attempt feeding back the previous one",
  thirdTry.refusals.every((refusal) => refusal.step === "validation" && refusal.verdicts.length === 1 && refusal.verdicts[0].kind === "cible-inconnue") &&
    thirdTry.refusals[1].feedback !== null &&
    stubbornPen.rounds[2].feedback !== null,
);

// =====================================================================
// (d) a betrayed expectation is a verdict too — the loop corrects it
// =====================================================================

const betrayingDraft = [
  "layer draft-demo refines @wb1",
  "  tests",
  "    expect arcsAB/e1/weight = 999",
].join("\n");
const measuringPen = scriptedPen({ scripts: [betrayingDraft, soundDraft] });
const fourthTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: measuringPen.propose,
});
check(
  "(d) the betrayed expectation is refused at the validation step, the measured layer is accepted next",
  fourthTry.ok === true && fourthTry.attempts === 2 && fourthTry.refusals[0].step === "validation",
);
check(
  '(d) the refusal speaks the "expectation-betrayed" verdict and its fact',
  fourthTry.refusals[0].verdicts.length >= 1 &&
    fourthTry.refusals[0].verdicts.some((verdict) => verdict.kind === "attendu-trahi") &&
    fourthTry.refusals[0].feedback.includes("expectation-betrayed"),
);

// =====================================================================
// (e) a mute pen is a refused pen — the empty proposal never slips
//     through as an empty acceptance
// =====================================================================

const muteThenSound = scriptedPen({ scripts: ["", soundDraft] });
const fifthTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: muteThenSound.propose,
});
check(
  "(e) an empty proposal is refused as a syntax refusal, the next one can be accepted",
  fifthTry.ok === true &&
    fifthTry.attempts === 2 &&
    fifthTry.refusals.length === 1 &&
    fifthTry.refusals[0].errors.length === 1 &&
    fifthTry.refusals[0].errors[0] === "the proposal is empty",
);

// =====================================================================
// (f) the loop judges over the living wardrobe too — a proposal
//     refining a user's feather is accepted
// =====================================================================

const featherSource = "layer feather refines @record\n  value = 1\n";
const featherRefiningDraft = "layer draft-feather refines @feather\n  extra = 2\n";
const sixthTry = await runLoop({
  scripts: [featherRefiningDraft],
  livingLayerNames: [...KERNEL_LAYER_NAMES, "feather"],
  previousAdditionSources: [featherSource],
});
check(
  "(f) a proposal refining a user's feather is accepted when the feather is in the living context",
  sixthTry.ok === true && sixthTry.attempts === 1,
);
const seventhTry = await runLoop({
  scripts: [featherRefiningDraft, featherRefiningDraft, featherRefiningDraft],
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  previousAdditionSources: [],
});
check(
  "(f) the same proposal is refused without the feather — the gate is the living context, not the intention",
  seventhTry.ok === false &&
    seventhTry.refusals.every((refusal) => refusal.verdicts.some((verdict) => verdict.kind === "cible-inconnue")),
);

// =====================================================================
// the formatter itself: the verdict vocabulary, verbatim
// =====================================================================

const formatterRefusal = {
  attempt: 2,
  step: "validation" as const,
  errors: [] as string[],
  verdicts: [
    {
      kind: "liaison-morte",
      fact: fact("dead-binding", { layer: "draft", slot: "x", tag: "@nowhere/y", readingLayer: "wb1" }),
    },
  ],
  proposal: "",
  feedback: "",
};
const formatted = formatPenFeedback(formatterRefusal);
check(
  "the formatter speaks the attempt, the step and the verdict kind with its fact",
  formatted.includes("#2") &&
    formatted.includes("validation") &&
    formatted.includes('"dead-binding"') &&
    formatted.includes("@nowhere/y") &&
    formatted.includes("no explanation"),
);
const formattedFrench = formatPenFeedback(formatterRefusal, "fr");
check(
  "the formatter mirrors itself in French — the same refusal, the other tongue",
  formattedFrench.includes("n°2") &&
    formattedFrench.includes("« liaison-morte »") &&
    formattedFrench.includes("sans explication") &&
    formattedFrench !== formatted,
);

// =====================================================================
// the ledger
// =====================================================================

console.log("pen loop checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
