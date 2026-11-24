// L4 (issue #286): the named-connection-points study is document-only
// (docs/connection-points.md) — but its candidate formalism is staged
// and JUDGED here, and the decisive dynamic-arity scenario is pinned:
// a new incoming wire adds an input to the gate (derived arity), while
// the declared arity stays — the mismatch a coherence check would fire.
//
//     node tests/connection-points-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assembleLayeredDataKernel,
  KERNEL_LAYER_NAMES,
} from "../src/application/corpus.ts";
import { applyStagedAddition, stageLayerAddition } from "../src/application/staging.ts";
import { AddressView } from "../src/domain/addresses.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";

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

// ---- the candidate: the n-ary-gate axis, staged and judged -----------

const axisDraft =
  "layer n-ary-gate refines @logic-circuit\n" +
  "  extend specification\n" +
  "    n_ary_gate_type refines @logic-circuit/specification/gate_type\n" +
  "      extend specification\n" +
  "        extend record\n" +
  "          abstract arity\n";
const axisStaging = stage(axisDraft, [], bedrock);
check("the n-ary-gate axis draft is accepted by the staging", axisStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: axisStaging,
  knownLayerNames: bedrock,
  readonlyLayerNames: bedrock,
});

const port = (name: string, identifier: number, direction: string) =>
  "    " + name + " refines @logic-circuit/specification/port_type\n" +
  "      identifier = " + identifier + "\n" +
  "      direction = \"" + direction + "\"\n";
const wire = (name: string, identifier: number, source: string, target: string) =>
  "    " + name + " refines @logic-circuit/specification/wire_type\n" +
  "      identifier = " + identifier + "\n" +
  "      source = @three-input/" + source + "\n" +
  "      target = @three-input/" + target + "\n";

const modelDraft =
  "layer three-input refines @n-ary-gate\n" +
  "  extend gates\n" +
  "    bigand refines @n-ary-gate/specification/n_ary_gate_type\n" +
  "      kind = \"and\"\n" +
  "      arity = 3\n" +
  "  extend ports\n" +
  port("a", 1, "in") + port("b", 2, "in") + port("c", 3, "in") + port("s", 4, "out") +
  "  extend wires\n" +
  wire("w1", 1, "ports/a", "gates/bigand") +
  wire("w2", 2, "ports/b", "gates/bigand") +
  wire("w3", 3, "ports/c", "gates/bigand") +
  wire("w4", 4, "gates/bigand", "ports/s");
const modelStaging = stage(modelDraft, [axisDraft], [...bedrock, "n-ary-gate"]);
check("the three-input proof model is accepted by the staging", modelStaging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: modelStaging,
  knownLayerNames: [...bedrock, "n-ary-gate"],
  readonlyLayerNames: bedrock,
});

// ---- the derived arity: count the incoming wires ----------------------

const incomingCount = (model: string): number => {
  let count = 0;
  for (const wireName of kernel.space.keys({
    layer: asLayerName(model),
    path: asLayerPath(["wires"]),
  })) {
    const target = kernel.space.read({
      layer: asLayerName(model),
      path: asLayerPath(["wires", wireName]),
      key: "target",
    });
    if (
      target instanceof AddressView &&
      target.path.length === 2 &&
      target.path[0] === "gates" &&
      target.path[1] === "bigand"
    ) {
      count++;
    }
  }
  return count;
};

check(
  "the derived arity of bigand is 3 (three incoming wires), the declared arity reads 3",
  incomingCount("three-input") === 3 &&
    kernel.space.read({
      layer: asLayerName("three-input"),
      path: asLayerPath(["gates", "bigand"]),
      key: "arity",
    }) === 3,
);

// ---- the decisive scenario: a fourth wire lands, the input appears ----

const modelDraftV2 =
  "layer three-input refines @n-ary-gate\n" +
  "  extend gates\n" +
  "    bigand refines @n-ary-gate/specification/n_ary_gate_type\n" +
  "      kind = \"and\"\n" +
  "      arity = 3\n" +
  "  extend ports\n" +
  port("a", 1, "in") + port("b", 2, "in") + port("c", 3, "in") + port("d", 4, "in") +
  port("s", 5, "out") +
  "  extend wires\n" +
  wire("w1", 1, "ports/a", "gates/bigand") +
  wire("w2", 2, "ports/b", "gates/bigand") +
  wire("w3", 3, "ports/c", "gates/bigand") +
  wire("w4", 4, "ports/d", "gates/bigand") +
  wire("w5", 5, "gates/bigand", "ports/s");
const v2Staging = stage(modelDraftV2, [axisDraft], [...bedrock, "n-ary-gate"]);
check("the four-input variant stages clean too (the wire is data)", v2Staging.verdicts.length === 0);
applyStagedAddition({
  space: kernel.space,
  staging: v2Staging,
  knownLayerNames: [...bedrock, "n-ary-gate"],
  readonlyLayerNames: bedrock,
});
check(
  "dynamic arity is alive: the new incoming wire adds an input (derived 4) while the declared arity stays 3",
  incomingCount("three-input") === 4 &&
    kernel.space.read({
      layer: asLayerName("three-input"),
      path: asLayerPath(["gates", "bigand"]),
      key: "arity",
    }) === 3,
);

// ---- the ledger -------------------------------------------------------

console.log(
  "connection-points checks: " + assertions + " assertions, " + failures.length + " failure(s)",
);
for (const failure of failures) console.log("  FAIL: " + failure);
if (failures.length > 0) process.exit(1);
