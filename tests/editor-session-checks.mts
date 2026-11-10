// The shared editor session checks (ADR-0110): the versioned state
// the server keeps and broadcasts, and the judged gesture — the same
// staging as the browser, optimistic locking on the version, the
// deterministic re-staging of every candidate addition over a fresh
// bedrock.
//
//     node tests/editor-session-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import {
  createEditorSession,
  layerNamesOfSource,
  parseEditorSession,
  serializeEditorSession,
} from "../src/application/editorSession.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the bedrock, as the server assembles it ------------------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const kernelLayerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);

const session = createEditorSession({ kernelLayerSources, kernelLayerNames: KERNEL_LAYER_NAMES });

// ---- layerNamesOfSource ---------------------------------------------

check(
  "layerNamesOfSource reads the declared layers in order",
  JSON.stringify(layerNamesOfSource({ source: "layer a\n  x = 1\nlayer b refines @a\n  y = 2" })) ===
    JSON.stringify(["a", "b"]),
);
check(
  "a `layer` word inside a comment never counts",
  layerNamesOfSource({ source: "// layer ghost\nlayer real\n  x = 1" }).join(",") === "real",
);

// ---- the empty session ----------------------------------------------

check("the session boots empty, version 0", session.readState().version === 0 && session.readState().additions.length === 0);

// ---- a creation gesture is accepted ---------------------------------

const creation = session.applyGesture({
  source: "layer pn-demo refines @petrinet-scheme then @positions-grid",
  baseVersion: 0,
});
check("a creation gesture is accepted", creation.ok);
if (creation.ok) {
  check("the version moved to 1", creation.state.version === 1);
  check(
    "the addition is kept with its block",
    creation.state.additions.length === 1 &&
      creation.state.additions[0]!.name === "pn-demo" &&
      creation.state.additions[0]!.source.startsWith("layer pn-demo"),
  );
}

// ---- an edition gesture replaces the entry --------------------------

const edition = session.applyGesture({
  source:
    "layer pn-demo refines @petrinet-scheme then @positions-grid\n" +
    "  extend places\n" +
    "    p1 refines @petrinet-scheme/specification/place_type",
  baseVersion: 1,
});
check("an edition gesture is accepted", edition.ok);
if (edition.ok) {
  check("the version moved to 2", edition.state.version === 2);
  check(
    "the addition was REPLACED, not appended",
    edition.state.additions.length === 1 && edition.state.additions[0]!.source.includes("p1"),
  );
}

// ---- optimistic locking: a stale baseVersion is a conflict ----------

const conflict = session.applyGesture({
  source:
    "layer pn-demo refines @petrinet-scheme then @positions-grid\n" +
    "  extend places\n" +
    "    p2 refines @petrinet-scheme/specification/place_type",
  baseVersion: 1,
});
check("a stale baseVersion is a conflict", !conflict.ok && conflict.reason === "conflict");
check("the conflict carries the CURRENT state", conflict.ok === false && conflict.state.version === 2);
check("the version did not move on conflict", session.readState().version === 2);

// ---- the bedrock is untouchable -------------------------------------

const theft = session.applyGesture({
  source: "layer graph refines @record\n  value = 1",
  baseVersion: 2,
});
check(
  "a gesture claiming a bedrock name is refused as socle-occupé",
  !theft.ok && theft.reason === "refused" && theft.refusals.some((refusal) => refusal.startsWith("socle-occupé")),
);
check("the version did not move on the refused theft", session.readState().version === 2);

// ---- the staging refuses: unknown target ----------------------------

const badTarget = session.applyGesture({
  source: "layer pn-bad refines @no-such-layer",
  baseVersion: 2,
});
check(
  "a draft refining an unknown layer is refused by the staging",
  !badTarget.ok && badTarget.reason === "refused" && badTarget.staging !== null && !badTarget.staging.ok,
);
check("the version did not move on the refused draft", session.readState().version === 2);

// ---- a source without any layer -------------------------------------

const noLayer = session.applyGesture({ source: "  x = 1", baseVersion: 2 });
check(
  "a source without a layer block is refused",
  !noLayer.ok && noLayer.reason === "refused" && noLayer.refusals.includes("aucune-couche"),
);

// ---- a multi-layer gesture adds every layer --------------------------

const multi = session.applyGesture({
  source: "layer pn-a refines @petrinet-scheme\nlayer pn-b refines @petrinet-scheme",
  baseVersion: 2,
});
check("a multi-layer gesture is accepted", multi.ok);
if (multi.ok) {
  check(
    "both layers entered the session",
    multi.state.version === 3 &&
      multi.state.additions.map((entry) => entry.name).join(",") === "pn-demo,pn-a,pn-b",
  );
}

// ---- persistence round-trip ------------------------------------------

const serialized = serializeEditorSession({ state: session.readState() });
const parsed = parseEditorSession({ text: serialized });
check("the serialized state parses back identically", JSON.stringify(parsed) === JSON.stringify(session.readState()));
check("garbage parses as no session, never an exception", parseEditorSession({ text: "not json {" }) === null);
check(
  "a state of the wrong shape parses as no session",
  parseEditorSession({ text: JSON.stringify({ version: "two", additions: [] }) }) === null,
);

// ---- report ----------------------------------------------------------

if (failures.length > 0) {
  console.error("editor session checks failed (" + failures.length + "):");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log("editor session checks: " + assertions + " assertions, 0 failure(s)");
