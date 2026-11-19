// The survey pass checks (issue #279): the fast model chooses the
// ground before the pen writes. The column can be cut to one
// comment line, the survey answer parses into questions or a
// validated selection, the ancestor closure is deterministic on
// the real kernel, and the filtered system prompt drops the
// selected layers from the column while keeping their full
// sources — and without a selection it is the monolith, unchanged.
//
//     node tests/survey-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../server/layerStore.ts";
import {
  SURVEY_INSTRUCTIONS_EN,
  ancestorClosure,
  buildSurveyPrompt,
  buildSystemPrompt,
  corpusBackbone,
  livingLayerNames,
  parentsOf,
  parseSurveyResponse,
} from "../server/geologistPrompts.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the column, cut to one comment line ---------------------------

const column4 = corpusBackbone({ visitorLayers: [] });
const column1 = corpusBackbone({ visitorLayers: [], maxCommentLines: 1 });
check(
  "(1) the default column keeps up to 4 comment lines per layer",
  column4.length > 25_000,
);
check(
  "(1) the one-line column is under ~11 000 chars (measured 10 746 on the 91-layer kernel)",
  column1.length <= 11_000,
);
check("(1) the one-line column is strictly smaller than the full column", column1.length < column4.length);

// ---- the survey prompt ----------------------------------------------

const surveyPrompt = buildSurveyPrompt({ visitorLayers: [] });
check("(2) the survey prompt carries the surveyor's instructions", surveyPrompt.includes(SURVEY_INSTRUCTIONS_EN));
check("(2) the survey prompt carries the one-line column", surveyPrompt.includes(column1));
check(
  "(2) the survey prompt stays under ~14 000 chars (measured 13 586 on the 91-layer kernel)",
  surveyPrompt.length <= 14_000,
);
check(
  "(2) the survey prompt does NOT carry the full column",
  !surveyPrompt.includes(column4),
);

// ---- the ancestor closure on the real kernel -------------------------

check(
  "(3) parentsOf reads the refines chain of the header (dag -> multidigraph)",
  JSON.stringify(parentsOf({ name: "dag", visitorLayers: [] })) === JSON.stringify(["multidigraph"]),
);
check(
  "(3) parentsOf reads a multiple inheritance (multidigraph -> named-ends-hypergraph, pair-graph)",
  JSON.stringify(parentsOf({ name: "multidigraph", visitorLayers: [] })) ===
    JSON.stringify(["named-ends-hypergraph", "pair-graph"]),
);
check(
  "(3) parentsOf of an unknown name is empty, never an exception",
  parentsOf({ name: "couche-inconnue", visitorLayers: [] }).length === 0,
);

const closureDag = ancestorClosure({ names: ["dag"], visitorLayers: [] });
for (const expected of ["multidigraph", "named-ends-hypergraph", "pair-graph", "multihypergraph", "record"]) {
  check("(3) closure(dag) contains " + expected, closureDag.includes(expected));
}
check("(3) closure(dag) does not contain the seed itself", !closureDag.includes("dag"));

const closureKahn = ancestorClosure({ names: ["kahn-scheme"], visitorLayers: [] });
for (const expected of ["bipartite-digraph", "k-partite-hypergraph", "multidigraph", "multihypergraph", "record"]) {
  check("(3) closure(kahn-scheme) contains " + expected, closureKahn.includes(expected));
}

// The closure also reads the visitors' layers, passed as data.
const visitorLayers = [
  { name: "mon-visiteur", source: "layer mon-visiteur refines @dag\n  extend specification\n" },
];
check(
  "(3) the closure crosses into the visitors' layers (mon-visiteur -> dag -> …)",
  ancestorClosure({ names: ["mon-visiteur"], visitorLayers }).includes("multidigraph"),
);

// ---- the survey answer parsing ---------------------------------------

const living = livingLayerNames({ visitorLayers: [] });
check(
  "(4) livingLayerNames is the kernel plus the visitors",
  living.length === KERNEL_LAYER_NAMES.length && living.includes("dag"),
);

const parsed = parseSurveyResponse({
  text: "@dag\n@kahn-scheme\n@bruit-inconnu\nlayer bidule\n",
  livingNames: living,
  visitorLayers: [],
});
check("(4) a selection keeps the living names, in order", parsed.kind === "selection" &&
  JSON.stringify(parsed.selected) === JSON.stringify(["dag", "kahn-scheme"]));
check(
  "(4) the selection is closed over its ancestors",
  parsed.kind === "selection" && parsed.closure.includes("multidigraph") && parsed.layers.length === parsed.selected.length + parsed.closure.length,
);
check(
  "(4) noise (unknown @names, prose) is ignored",
  parsed.kind === "selection" && !parsed.layers.includes("bruit-inconnu") && !parsed.layers.includes("bidule"),
);

const parsedEmpty = parseSurveyResponse({
  text: "je ne sais pas quoi répondre",
  livingNames: living,
  visitorLayers: [],
});
check(
  "(4) an answer without any living name is an empty selection (the route falls back)",
  parsedEmpty.kind === "selection" && parsedEmpty.layers.length === 0,
);

const parsedQuestions = parseSurveyResponse({
  text: "QUESTION: les flux sont-ils orientés ?\nquestion: le temps est-il discret ?\n@dag",
  livingNames: living,
  visitorLayers: [],
});
check(
  "(4) QUESTION: lines (case-insensitive) turn the answer into questions, names ignored",
  parsedQuestions.kind === "questions" &&
    JSON.stringify(parsedQuestions.questions) ===
      JSON.stringify(["les flux sont-ils orientés ?", "le temps est-il discret ?"]),
);

// ---- the filtered system prompt --------------------------------------

const monolith = buildSystemPrompt({ visitorLayers: [] });
check(
  "(5) without a selection the prompt is the monolith (measured 36 626 chars)",
  monolith.length > 35_000 && buildSystemPrompt({ visitorLayers: [], selectedLayerNames: [] }) === monolith,
);

const dagSource = readFileSync(join(import.meta.dirname, "..", "formalisms", "kernel", "dag.ld"), "utf8");
const filtered = buildSystemPrompt({ visitorLayers: [], selectedLayerNames: ["dag", "kahn-scheme"] });
check(
  "(5) the filtered prompt carries the full source of a selected layer",
  filtered.includes(dagSource.trim()),
);
check(
  "(5) the filtered prompt drops the selected layers from the column (dag's header appears once — in its full source, not in the column)",
  filtered.split("layer dag refines @multidigraph").length === 2,
);
check(
  "(5) the filtered prompt annotates the ancestors (multidigraph keeps its header)",
  filtered.includes("layer multidigraph refines @named-ends-hypergraph then @pair-graph"),
);
check(
  "(5) the filtered prompt lists the other layers as bare names behind the marker",
  filtered.includes("// … autres couches du socle (noms nus — pas le terrain de cette proposition) :") &&
    filtered.includes("\nlayer record\n"),
);
check(
  "(5) the filtered prompt is much smaller than the monolith (measured 8 327 for dag+kahn)",
  filtered.length < monolith.length / 2,
);
check(
  "(5) the filtered prompt does NOT carry the fixed examples block",
  !filtered.includes("UN EXEMPLE COMPLET DE FORMALISME"),
);

// A selected visitor layer: full source in the selected block, and
// the other visitors stay bare names.
const filteredVisitor = buildSystemPrompt({
  visitorLayers: [
    ...visitorLayers,
    { name: "autre-visiteur", source: "layer autre-visiteur refines @graph\n" },
  ],
  selectedLayerNames: ["mon-visiteur"],
});
check(
  "(5) a selected visitor layer appears in full, the others as bare names",
  filteredVisitor.includes("layer mon-visiteur refines @dag") &&
    filteredVisitor.includes("\nlayer autre-visiteur\n") &&
    !filteredVisitor.includes("layer autre-visiteur refines @graph"),
);

// ---- the verdict ------------------------------------------------------

console.log(assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("FAIL: " + failure);
  process.exit(1);
}
