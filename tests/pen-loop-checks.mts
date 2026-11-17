// The verified geologist loop checks: the geologist proposes, the staging
// judges, the refusal travels back with its verdicts.
//
// The loop itself is pure — the model call is injected — so the
// whole protocol is verified offline, against deterministic pens
// that fail and correct themselves: syntax errors, orphan
// targets, betrayed expectations, mute proposals. The loop must
// accept exactly what the workshop staging accepts, refuse with
// the kernel's own verdict vocabulary, and never let an
// unverified draft through.
//
//     node tests/pen-loop-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { fact } from "../src/domain/messages.ts";
import {
  composeVerifiedLayerDraft,
  formatPenFeedback,
  type PenLoopOutcome,
  type PenRound,
} from "../src/application/penLoop.ts";
import { buildSystemPrompt, corpusBackbone } from "../server/geologistPrompts.ts";
import { extractProposalContent } from "../server/mistralClient.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the upstream content extraction (mistral-large answers with
// content blocks: thinking first, then text) ----
check(
  "(0) a plain string content passes through unchanged",
  extractProposalContent({ content: "layer x refines @graph" }) === "layer x refines @graph",
);
check(
  "(0) a content-block list joins only the text blocks (thinking skipped)",
  extractProposalContent({
    content: [
      { type: "thinking", thinking: [{ type: "text", text: "hmm" }] },
      { type: "text", text: "layer a" },
      { type: "text", text: "layer b" },
    ],
  }) === "layer alayer b",
);
check(
  "(0) a missing or non-text content yields an empty proposal",
  extractProposalContent({ content: undefined }) === "" &&
    extractProposalContent({ content: null }) === "" &&
    extractProposalContent({ content: 42 }) === "" &&
    extractProposalContent({ content: [{ type: "thinking" }] }) === "",
);

// ---- the bedrock context, as the server builds it ---------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

/** A deterministic geologist replaying a script of proposals, recording
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

function runLoop({
  scripts,
  livingLayerNames = [...KERNEL_LAYER_NAMES],
  readonlyLayerNames = [...KERNEL_LAYER_NAMES],
  previousAdditionSources = [],
}: {
  scripts: string[];
  livingLayerNames?: string[];
  readonlyLayerNames?: string[];
  previousAdditionSources?: string[];
}): Promise<PenLoopOutcome> {
  return composeVerifiedLayerDraft({
    instruction: "une couche de démonstration",
    languageSource: kernel.languageSource,
    livingLayerNames,
    readonlyLayerNames,
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

/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "(a) a sound proposal is accepted first try: ok, one attempt, no refusal",
  firstTry.ok === true &&
    firstTry.attempts === 1 &&
    firstTry.refusals.length === 0,
);
check(
  "(a) the accepted draft source is the proposal itself, staged",
  firstTry.draftSource === soundDraft &&
    firstTry.staging !== null &&
    firstTry.staging.ok === true,
);
check("(a) the first round carries no feedback", firstTry.staging !== null);

// =====================================================================
// (b) a syntax error is refused, the verdict travels back, the
//     corrected proposal is accepted — the loop at work
// =====================================================================

const brokenDraft =
  "layer draft-demo refines @wb1\n  extend arcsAB\n    e3 = oops \x1b[[";
const correctivePen = scriptedPen({ scripts: [brokenDraft, soundDraft] });
const secondTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: correctivePen.propose,
});
check(
  "(b) the broken-then-corrected geologist is accepted at the second attempt",
  secondTry.ok === true && secondTry.attempts === 2,
);
check(
  "(b) the first round carried no feedback, the second carried the syntax refusal",
  correctivePen.rounds.length === 2 &&
    at(correctivePen.rounds, 0).feedback === null &&
    at(correctivePen.rounds, 1).feedback !== null,
);
check(
  "(b) the refusal is a syntax step with readable errors",
  secondTry.refusals.length === 1 &&
    at(secondTry.refusals, 0).step === "syntaxe" &&
    at(secondTry.refusals, 0).errors.length > 0,
);
check(
  "(b) the feedback speaks the refusal to the model: attempt number, step, error, the order to rewrite",
  at(secondTry.refusals, 0).feedback.includes("#1") &&
    at(secondTry.refusals, 0).feedback.includes("syntax") &&
    at(secondTry.refusals, 0).feedback.includes("no explanation"),
);
check(
  "(b) the feedback the model received is exactly the formatted refusal",
  at(correctivePen.rounds, 1).feedback === at(secondTry.refusals, 0).feedback,
);

// =====================================================================
// (c) a geologist that never corrects itself exhausts the budget
// =====================================================================

const orphanDraft = "layer draft-orphan refines @unknown-layer\n  value = 1\n";
const stubbornPen = scriptedPen({
  scripts: [orphanDraft, orphanDraft, orphanDraft],
});
const thirdTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: stubbornPen.propose,
});
check(
  "(c) the stubborn geologist exhausts the budget: refused after three attempts",
  thirdTry.ok === false &&
    thirdTry.attempts === 3 &&
    thirdTry.refusals.length === 3,
);
check(
  "(c) a spent budget carries no draft and no staging",
  thirdTry.draftSource === null && thirdTry.staging === null,
);
check(
  "(c) every refusal is the kernel's own verdict vocabulary (cible-inconnue), each attempt feeding back the previous one",
  thirdTry.refusals.every(
    (refusal) =>
      refusal.step === "validation" &&
      refusal.verdicts.length === 1 &&
      at(refusal.verdicts, 0).kind === "cible-inconnue",
  ) &&
    at(thirdTry.refusals, 1).feedback !== null &&
    at(stubbornPen.rounds, 2).feedback !== null,
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
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: measuringPen.propose,
});
check(
  "(d) the betrayed expectation is refused at the validation step, the measured layer is accepted next",
  fourthTry.ok === true &&
    fourthTry.attempts === 2 &&
    at(fourthTry.refusals, 0).step === "validation",
);
check(
  '(d) the refusal speaks the "expectation-betrayed" verdict and its fact',
  at(fourthTry.refusals, 0).verdicts.length >= 1 &&
    at(fourthTry.refusals, 0).verdicts.some(
      (verdict) => verdict.kind === "attendu-trahi",
    ) &&
    at(fourthTry.refusals, 0).feedback.includes("expectation-betrayed"),
);

// =====================================================================
// (e) a mute geologist is a refused geologist — the empty proposal never slips
//     through as an empty acceptance
// =====================================================================

const muteThenSound = scriptedPen({ scripts: ["", soundDraft] });
const fifthTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: muteThenSound.propose,
});
check(
  "(e) an empty proposal is refused as a syntax refusal, the next one can be accepted",
  fifthTry.ok === true &&
    fifthTry.attempts === 2 &&
    fifthTry.refusals.length === 1 &&
    at(fifthTry.refusals, 0).errors.length === 1 &&
    at(at(fifthTry.refusals, 0).errors, 0) === "the proposal is empty",
);

// =====================================================================
// (f) the loop judges over the living quarry too — a proposal
//     refining a user's layer is accepted
// =====================================================================

const userLayerSource = "layer userlayer refines @record\n  value = 1\n";
const userLayerRefiningDraft =
  "layer draft-userlayer refines @userlayer\n  extra = 2\n";
const sixthTry = await runLoop({
  scripts: [userLayerRefiningDraft],
  livingLayerNames: [...KERNEL_LAYER_NAMES, "userlayer"],
  previousAdditionSources: [userLayerSource],
});
check(
  "(f) a proposal refining a user's layer is accepted when the layer is in the living context",
  sixthTry.ok === true && sixthTry.attempts === 1,
);
const seventhTry = await runLoop({
  scripts: [
    userLayerRefiningDraft,
    userLayerRefiningDraft,
    userLayerRefiningDraft,
  ],
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  previousAdditionSources: [],
});
check(
  "(f) the same proposal is refused without the layer — the gate is the living context, not the intention",
  seventhTry.ok === false &&
    seventhTry.refusals.every((refusal) =>
      refusal.verdicts.some((verdict) => verdict.kind === "cible-inconnue"),
    ),
);

// =====================================================================
// (g) the geologist cannot replace the bedrock (ADR-0103): a proposal
//     claiming a bedrock name is refused « socle-occupé », the
//     corrected proposal — a refinement — is accepted
// =====================================================================

const bedrockClaimingDraft =
  'layer record\n  specification\n    record = "volé"\n';
const claimingThenSound = scriptedPen({
  scripts: [bedrockClaimingDraft, soundDraft],
});
const eighthTry = await composeVerifiedLayerDraft({
  instruction: "une couche de démonstration",
  languageSource: kernel.languageSource,
  livingLayerNames: [...KERNEL_LAYER_NAMES],
  readonlyLayerNames: [...KERNEL_LAYER_NAMES],
  maxAttempts: 3,
  propose: claimingThenSound.propose,
});
check(
  "(g) the bedrock-claiming proposal is refused, the corrected refinement is accepted",
  eighthTry.ok === true && eighthTry.attempts === 2,
);
check(
  '(g) the refusal speaks the "bedrock-occupied" verdict — the theft named, the geologist told',
  at(eighthTry.refusals, 0).verdicts.length === 1 &&
    at(at(eighthTry.refusals, 0).verdicts, 0).kind === "socle-occupé" &&
    at(eighthTry.refusals, 0).feedback.includes("bedrock-occupied") &&
    at(eighthTry.refusals, 0).feedback.includes("record"),
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
      fact: fact("dead-binding", {
        layer: "draft",
        slot: "x",
        tag: "@nowhere/y",
        readingLayer: "wb1",
      }),
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
  "the formatter falls back to English when asked for French — French content is absent (ADR-0113)",
  formattedFrench === formatted,
);

// ---- the grounding prompt (issue #245): the geologist must see the
// column WITH its descriptions, the expected structure, and complete
// examples of both species (formalism and model) ----------------------

const systemPrompt = buildSystemPrompt({ visitorLayers: [] });
check(
  "(h) the column carries each layer's header AND its leading comments",
  corpusBackbone({ visitorLayers: [] }).includes("layer petrinet-scheme refines") &&
    corpusBackbone({ visitorLayers: [] }).includes("//"),
);
check(
  "(h) the prompt spells out the expected structure (formalism vs model, most specific parent)",
  systemPrompt.includes("LA STRUCTURE ATTENDUE") &&
    systemPrompt.includes("@petrinet-scheme, pas @graph"),
);
check(
  "(h) the prompt embeds the complete formalism example (bipartite-digraph) — body line, not just the column header",
  systemPrompt.includes("override container = @bipartite-digraph/left"),
);
check(
  "(h) the prompt embeds the complete model example (pn-philosophers-1) — body line, not just the column header",
  systemPrompt.includes("think1 refines @pn-philosophers/specification/think"),
);
check(
  "(h) the visitor layers travel in the column and in the prompt",
  buildSystemPrompt({
    visitorLayers: [{ name: "visiteur-1", source: "layer visiteur-1 refines @graph\n" }],
  }).includes("layer visiteur-1 refines @graph"),
);

// =====================================================================
// (i) the two-pass fixtures (issue #279): proposals that the real
// staging accepts in ONE attempt — a distant formalism+model pair
// (boolean-circuit / bc-half-adder) and a close model
// (pn-philosophers-3, authored for this test) — plus a refusal that
// the loop carries back (expectation-betrayed) before accepting the
// corrected round
// =====================================================================

const booleanCircuitFixture = `layer boolean-circuit refines @dag
  extend specification
    gate_type refines @boolean-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract function
    port_type refines @boolean-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract direction
    wire_type refines @boolean-circuit/edge_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @boolean-circuit/vertices
          extend target
            override container = @boolean-circuit/vertices
  gates refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/gate_type
  ports refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/port_type
  wires refines @collection
    extend specification
      extend collection
        override type = @boolean-circuit/specification/wire_type
  extend vertices refines @boolean-circuit/gates then @boolean-circuit/ports
  extend edges refines @boolean-circuit/wires

layer bc-half-adder refines @boolean-circuit
  extend gates
    xorg refines @boolean-circuit/specification/gate_type
      identifier = 1
      function = "xor"
    andg refines @boolean-circuit/specification/gate_type
      identifier = 2
      function = "and"
  extend ports
    a refines @boolean-circuit/specification/port_type
      identifier = 1
      direction = "in"
    b refines @boolean-circuit/specification/port_type
      identifier = 2
      direction = "in"
    s refines @boolean-circuit/specification/port_type
      identifier = 3
      direction = "out"
    c refines @boolean-circuit/specification/port_type
      identifier = 4
      direction = "out"
  extend wires
    w1 refines @boolean-circuit/specification/wire_type
      identifier = 1
      source = @bc-half-adder/ports/a
      target = @bc-half-adder/gates/xorg
    w2 refines @boolean-circuit/specification/wire_type
      identifier = 2
      source = @bc-half-adder/ports/b
      target = @bc-half-adder/gates/xorg
    w3 refines @boolean-circuit/specification/wire_type
      identifier = 3
      source = @bc-half-adder/ports/a
      target = @bc-half-adder/gates/andg
    w4 refines @boolean-circuit/specification/wire_type
      identifier = 4
      source = @bc-half-adder/ports/b
      target = @bc-half-adder/gates/andg
    w5 refines @boolean-circuit/specification/wire_type
      identifier = 5
      source = @bc-half-adder/gates/xorg
      target = @bc-half-adder/ports/s
    w6 refines @boolean-circuit/specification/wire_type
      identifier = 6
      source = @bc-half-adder/gates/andg
      target = @bc-half-adder/ports/c
  tests
    expect gates/xorg/function = "xor"
    expect ports/a/direction = "in"
    expect wires/w1/source = @bc-half-adder/ports/a
    expect ports/s/direction = "out"`;

const philosophers3Fixture = `layer pn-philosophers-3 refines @pn-philosophers then @positions-grid
  philosophes refines @collection
    philo1 refines @pn-philosophers-1
      identifier = 1
    philo2 refines @pn-philosophers-1
      identifier = 2
    philo3 refines @pn-philosophers-1
      identifier = 3
  extend places refines @pn-philosophers-3/philosophes/philo1/places then @pn-philosophers-3/philosophes/philo2/places then @pn-philosophers-3/philosophes/philo3/places
  extend transitions refines @pn-philosophers-3/philosophes/philo1/transitions then @pn-philosophers-3/philosophes/philo2/transitions then @pn-philosophers-3/philosophes/philo3/transitions
  extend pre_arcs refines @pn-philosophers-3/philosophes/philo1/pre_arcs then @pn-philosophers-3/philosophes/philo2/pre_arcs then @pn-philosophers-3/philosophes/philo3/pre_arcs
    fk1 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-3/places/philo1.fork1
      target = @pn-philosophers-3/transitions/philo2.take1
    fk2 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-3/places/philo2.fork1
      target = @pn-philosophers-3/transitions/philo3.take1
    fk3 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-3/places/philo3.fork1
      target = @pn-philosophers-3/transitions/philo1.take1
  extend post_arcs refines @pn-philosophers-3/philosophes/philo1/post_arcs then @pn-philosophers-3/philosophes/philo2/post_arcs then @pn-philosophers-3/philosophes/philo3/post_arcs
    rf1 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-3/transitions/philo2.release1
      target = @pn-philosophers-3/places/philo1.fork1
    rf2 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-3/transitions/philo3.release1
      target = @pn-philosophers-3/places/philo2.fork1
    rf3 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-3/transitions/philo1.release1
      target = @pn-philosophers-3/places/philo3.fork1
  extend positions refines @pn-philosophers-3/philosophes/philo1/positions then @pn-philosophers-3/philosophes/philo2/positions then @pn-philosophers-3/philosophes/philo3/positions
    table refines @positions-grid/specification/position_type
      x = 0
      y = 0
    philo1.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-3/positions/table
      r = 190
      theta = 0
    philo2.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-3/positions/table
      r = 190
      theta = 120
    philo3.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-3/positions/table
      r = 190
      theta = 240
  tests
    expect places/philo1.think1/marking = 1
    expect places/philo2.eat1/marking = 0
    expect philosophes/philo3/identifier = 3
    expect pre_arcs/fk3/source = @pn-philosophers-3/places/philo3.fork1
    expect post_arcs/rf1/target = @pn-philosophers-3/places/philo1.fork1
    expect positions/philo2.seat/theta = 120
    expect positions/philo1.seat/x absent`;

const annexAOutcome = await runLoop({ scripts: [booleanCircuitFixture] });
check(
  "(i) the distant fixture (boolean-circuit + bc-half-adder) is accepted in ONE attempt by the real staging",
  annexAOutcome.ok && annexAOutcome.attempts === 1,
);

const annexBOutcome = await runLoop({ scripts: [philosophers3Fixture] });
check(
  "(i) the close fixture (pn-philosophers-3, ring modulo 3, polar seats 0/120/240) is accepted in ONE attempt",
  annexBOutcome.ok && annexBOutcome.attempts === 1,
);

const betrayedFixture = philosophers3Fixture.replace(
  "expect places/philo1.think1/marking = 1",
  "expect places/philo1.think1/marking = 7",
);
const refusalOutcome = await runLoop({ scripts: [betrayedFixture, philosophers3Fixture] });
check(
  "(i) a betrayed expectation is refused (attendu-trahi) and the corrected round is accepted",
  refusalOutcome.ok &&
    refusalOutcome.attempts === 2 &&
    refusalOutcome.refusals.length === 1 &&
    refusalOutcome.refusals[0]?.verdicts.some((verdict) => verdict.kind === "attendu-trahi") === true,
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "geologist loop checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
