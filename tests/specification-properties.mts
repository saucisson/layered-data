// The executable specification of the kernel.
//
// docs/specification.md is normative: obligations O1–O18 and
// conformance requirements C1–C8 — and, since ADR-0106, the
// two-regime theorems T1–T3 (§14). This file checks them as
// properties — over the whole bedrock corpus (every observable
// address, the same walk as the audit harness) and over dedicated
// spaces built for the semantics the corpus does not exercise
// (implicits, the cycle guard, the touch
// protocol). These are conformance measurements, not formal
// demonstrations. Every "measured" expectation was read from the
// running kernel first, then frozen — the same discipline as the
// baseline dump.
//
//     node tests/specification-properties.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Space, type ReadObservation } from "../src/domain/space.ts";
import {
  AddressView,
  type Address,
  LayerReference,
  PathReference,
  isDictionary,
} from "../src/domain/addresses.ts";
import { asLayerName, asLayerPath, type LayerName } from "../src/domain/identifiers.ts";
import { SPECIAL_KEYS } from "../src/domain/specialKeys.ts";
import { desugarLayer, layerTopologicalOrder, rawTreeWalk, refinementEntriesEqual } from "../src/domain/desugaring.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import { walkAddresses } from "../src/domain/views.ts";
import { orderConflictsOf } from "../src/domain/conflicts.ts";
import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import {
  checkRegistry,
  registryContractsOf,
  runChecks,
  runChecksFO,
  slotReadingLevelsOf,
  vacantChecksOf,
} from "../src/domain/checks.ts";
import { checkSlotContractsOf, validateSpace } from "../src/domain/validation.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- corpus assembly (same route as the audit harness) --------------

const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);

/** A space assembled from sources joined in the given layer order —
 * the order of the join is the only thing that varies. */
function spaceFromJoinOrder(order: readonly string[]): Space {
  return spaceFromSourcesMap(layerSources, order);
}

/** A space assembled from a VARIANT of the corpus sources — the
 * data-driven semantics check (ADR-0102) edits the registry layer
 * itself, the rest of the bedrock joins unchanged. */
function spaceFromSourcesMap(sources: Record<string, string>, order: readonly string[]): Space {
  const joined = order
    .map((layerName) =>
      sources[layerName].endsWith("\n") ? sources[layerName] : sources[layerName] + "\n",
    )
    .join("");
  const parsed = parseLanguage(joined);
  const compiled = compileLanguage(parsed.layers);
  return new Space(compiled.layers);
}

/** A space built from written .ld sources — the full language
 * pipeline on a dedicated, minimal corpus. */
function spaceFromWrittenSources(sources: readonly string[]): Space {
  const joined = sources.map((source) => (source.endsWith("\n") ? source : source + "\n")).join("");
  const parsed = parseLanguage(joined);
  const compiled = compileLanguage(parsed.layers);
  return new Space(compiled.layers);
}

// ---- representation helpers -----------------------------------------

function addressText([layer, path]: Address): string {
  return layer + (path.length ? "/" + path.join("/") : "");
}

function valueText(value: unknown): string {
  if (value instanceof AddressView) return "@" + addressText([value.layer, value.path]);
  if (value instanceof PathReference) return "@R:" + value.anchor + "/" + value.path.join("/");
  if (value instanceof LayerReference) return "@L:" + value.layer;
  return JSON.stringify(value) ?? String(value);
}

/** The observable dump of a space: closures, keys, reads — the C1/C2/C3
 * protocol over every address. */
function observableDump({ space, walkOrder }: { space: Space; walkOrder: readonly string[] }): string[] {
  const lines: string[] = [];
  for (const layerName of walkOrder) {
    for (const address of walkAddresses({ space, layer: asLayerName(layerName) })) {
      lines.push("closure " + addressText(address) + " => " + space.closure({ layer: address[0], path: address[1] }).map(addressText).join(" "));
      lines.push("keys " + addressText(address) + " => " + space.keys({ layer: address[0], path: address[1] }).join(" "));
      for (const key of space.keys({ layer: address[0], path: address[1] })) {
        lines.push("read " + addressText(address) + " :: " + key + " => " + valueText(space.read({ layer: address[0], path: address[1], key })));
      }
    }
  }
  return lines;
}

/** Structural comparison of raw trees — references by their fields,
 * dicts key by key in insertion order. */
function rawTreesEqual(first: unknown, second: unknown): boolean {
  if (first instanceof PathReference || second instanceof PathReference) {
    return first instanceof PathReference && second instanceof PathReference && refinementEntriesEqual(first, second);
  }
  if (first instanceof LayerReference || second instanceof LayerReference) {
    return first instanceof LayerReference && second instanceof LayerReference && refinementEntriesEqual(first, second);
  }
  if (isDictionary(first) && isDictionary(second)) {
    const firstKeys = Object.keys(first);
    if (firstKeys.join("") !== Object.keys(second).join("")) return false;
    return firstKeys.every((key) => rawTreesEqual(first[key], second[key]));
  }
  if (Array.isArray(first) && Array.isArray(second)) {
    return first.length === second.length && first.every((item, index) => rawTreesEqual(item, second[index]));
  }
  return first === second;
}

/** A manual snapshot of raw trees — structuredClone would lose the
 * reference classes. */
function cloneTree(value: unknown): unknown {
  if (value instanceof PathReference) return new PathReference(value.anchor, [...value.path]);
  if (value instanceof LayerReference) return new LayerReference(value.layer);
  if (Array.isArray(value)) return value.map(cloneTree);
  if (isDictionary(value)) {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) copy[key] = cloneTree(value[key]);
    return copy;
  }
  return value;
}

/** A space built from raw layer trees written as literals — the one
 * legitimate cast: the literals are plain data, the layer names go
 * through the named conversion. */
function spaceFromLayerTrees(trees: Record<string, Record<string, unknown>>): Space {
  const layers: Record<string, unknown> = {};
  for (const layerName of Object.keys(trees)) layers[asLayerName(layerName)] = trees[layerName];
  return new Space(layers as never);
}

/** String-keyed access to the raw tree of one layer. */
function layerTreeOf(space: Space, layerName: string): Record<string, unknown> {
  return (space.layers as never as Record<string, Record<string, unknown>>)[layerName];
}

// =====================================================================
// C1 — CLOSURES over the whole bedrock corpus
// =====================================================================

const bedrock = spaceFromJoinOrder(KERNEL_LAYER_NAMES);
let walkedAddresses = 0;
let closureDuplicates = 0;
let ownNodeNotFirst = 0;

for (const layerName of KERNEL_LAYER_NAMES) {
  for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
    walkedAddresses++;
    const [layer, path] = address;
    const closure = bedrock.closure({ layer, path });

    // O3 — deduplication: an address appears at most once.
    const seen = new Set<string>();
    for (const source of closure) {
      const key = addressText(source);
      if (seen.has(key)) closureDuplicates++;
      seen.add(key);
    }

    // O2 — specificity: the own node, when it exists, comes first.
    if (bedrock.raw({ layer, path }) !== null && closure.length > 0) {
      if (addressText(closure[0]) !== addressText(address)) ownNodeNotFirst++;
    }
  }
}

check("C1 (O3): no closure of the bedrock corpus contains a duplicate address", closureDuplicates === 0);
check("C1 (O2): the own node is always the first source when it exists", ownNodeNotFirst === 0);
check("C1: the walk covers the measured corpus (thousands of addresses)", walkedAddresses > 2000);

// The measured diamond (§12): the two ways of the refinement cross.
const diamondClosure = bedrock.closure({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e2"]) });
check(
  "C1 (O4, measured diamond §12): the closure of wb1::arcsAB::e2 is exactly the §12 walk",
  diamondClosure.map(addressText).join(" ") ===
    "wb1/arcsAB/e2 " +
      "bipartite-digraph/specification/arcAB_type " +
      "multidigraph/edge_type " +
      "multihypergraph/specification/edge_type " +
      "record " +
      "pair-graph/edge_type " +
      "weighted-hypergraph/edge_type " +
      "edge-annotated-hypergraph/edge_type",
);
check(
  "C1 (O2, measured diamond §12): the first way of the diamond (bd specification) precedes the second (weight)",
  diamondClosure.findIndex(([l, p]) => l === "bipartite-digraph" && p.join("/") === "specification/arcAB_type") <
    diamondClosure.findIndex(([l, p]) => l === "weighted-hypergraph" && p.join("/") === "edge_type"),
);
check(
  "C1 (O4, measured diamond §12): the closure counts exactly the eight sources of the §12 walk",
  diamondClosure.length === 8,
);

// =====================================================================
// C2 — READS, first winner and observable statuses
// =====================================================================

let statusAnomalies = 0;
let winnerAnomalies = 0;
let scalarNodeAnomalies = 0;
for (const layerName of KERNEL_LAYER_NAMES) {
  for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
    const [layer, path] = address;
    for (const key of bedrock.keys({ layer, path })) {
      const scan: ReadObservation[] = [];
      const value = bedrock.read({ layer, path, key, scan });

      // O8 — the statuses are exactly the three documented ones
      // (the mask retired with ADR-0106: fournit, transparent, absent).
      const statuses = scan.map((observation) => observation.status);
      for (const status of statuses) {
        if (!["fournit", "transparent", "absent"].includes(status)) statusAnomalies++;
      }

      // C2 — first winner: the scan is cut by at most one source,
      // always at the winner, and a visible value implies a cut.
      const winners = statuses.filter((status) => status === "fournit").length;
      if (winners > 1) winnerAnomalies++;
      if (winners === 1 && statuses[statuses.length - 1] !== "fournit") winnerAnomalies++;
      if (value !== null && value !== undefined && winners === 0) winnerAnomalies++;

      // O1 — a scalar is never a node: the raw of its address is null.
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
        if (bedrock.raw({ layer: asLayerName(layer), path: asLayerPath([...path, key]) }) !== null) scalarNodeAnomalies++;
      }
    }
  }
}

check("C2 (O8): the statuses of every visible read are exactly fournit/transparent/absent", statusAnomalies === 0);
check("C2: every read is cut by at most one winner, at the winner (first-winner)", winnerAnomalies === 0);
check("C2 (O1): no scalar is ever visible as a node", scalarNodeAnomalies === 0);

// Measured conformance anchors (S10 and the late-binding flagship).

check(
  "C2 (S10, measured): wb1::arcsAB::e1::weight is the own override 3",
  bedrock.read({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e1"]), key: "weight" }) === 3,
);
check(
  "C2 (S10, measured): wb1::arcsAB::e2::weight is the inherited default 1 — through the second way of the diamond",
  bedrock.read({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e2"]), key: "weight" }) === 1,
);
check(
  "C2 (O6, measured): the late binding of ss-pn-philosophers-5-inst::alphabet::b1::transition resolves to the dinner",
  valueText(bedrock.read({ layer: asLayerName("ss-pn-philosophers-5-inst"), path: asLayerPath(["alphabet", "b1"]), key: "transition" })) === "@pn-philosophers-5/transitions/philo1.take1",
);
check(
  "C2 (measured): the state delta overrides the template marking (2 against 1)",
  bedrock.read({ layer: asLayerName("ss-pn-philosophers-5-inst"), path: asLayerPath(["states", "s1", "places", "philo1.think1"]), key: "marking" }) === 2,
);

// =====================================================================
// C3 — KEYS
// =====================================================================

let keysAnomalies = 0;
for (const layerName of KERNEL_LAYER_NAMES) {
  for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
    const keys = bedrock.keys({ layer: address[0], path: address[1] });
    // no special key ever surfaces, no duplicates, stable order
    if (keys.some((key) => (SPECIAL_KEYS as readonly string[]).includes(key))) keysAnomalies++;
    if (new Set(keys).size !== keys.length) keysAnomalies++;
    if (bedrock.keys({ layer: address[0], path: address[1] }).join("") !== keys.join("")) keysAnomalies++;
  }
}
check("C3: keys never surface a special key, never repeat, and are call-stable", keysAnomalies === 0);

// =====================================================================
// C4 — ANCHORS: O7 as an independent recomputation
// =====================================================================

let anchorsAnomalies = 0;
for (const layerName of KERNEL_LAYER_NAMES) {
  for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
    const expected: string[] = [];
    for (const [sourceLayer, sourcePath] of bedrock.closure({ layer: address[0], path: address[1] })) {
      const anchor = sourcePath.length ? sourcePath[sourcePath.length - 1] : sourceLayer;
      if (!expected.includes(anchor)) expected.push(anchor);
    }
    const observed = bedrock.anchorsAt({ layer: address[0], path: address[1], tracer: null });
    if (observed.join("") !== expected.join("")) anchorsAnomalies++;
  }
}
check("C4 (O7): anchorsAt is exactly the ordered union of the closure anchors, over every address", anchorsAnomalies === 0);
check(
  "C4 (measured diamond §12): the anchors of wb1::arcsAB::e2 are the closure walk",
  bedrock.anchorsAt({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e2"]), tracer: null }).join(",") === "e2,arcAB_type,edge_type,record",
);

// =====================================================================
// C8 — IMMUTABILITY: call-order independence and permutation
// invariance (the recommended property of the specification §11)
// =====================================================================

check(
  "C8 (O16): no touch, no stale memo entry over the whole walk",
  bedrock.staleMemoKeys().length === 0,
);

const secondAssembly = spaceFromJoinOrder(KERNEL_LAYER_NAMES);
const reverseWalk = observableDump({ space: secondAssembly, walkOrder: [...KERNEL_LAYER_NAMES].reverse() });
const referenceDump = new Set(observableDump({ space: bedrock, walkOrder: KERNEL_LAYER_NAMES }));
let orderDifferences = 0;
for (const line of reverseWalk) if (!referenceDump.has(line)) orderDifferences++;
check(
  "C8 (O16): walking every address in reverse order changes no result",
  orderDifferences === 0 && reverseWalk.length === referenceDump.size,
);

const permutedAssembly = spaceFromJoinOrder([...KERNEL_LAYER_NAMES].reverse());
const permutedDump = observableDump({ space: permutedAssembly, walkOrder: KERNEL_LAYER_NAMES });
let permutationDifferences = 0;
for (const line of permutedDump) if (!referenceDump.has(line)) permutationDifferences++;
check(
  "C8 (permutation invariance): assembling the 47 layers in reverse order changes no closure, no keys, no read",
  permutationDifferences === 0 && permutedDump.length === referenceDump.size,
);

// =====================================================================
// O5 / O17 — THE CYCLE GUARD, on a dedicated two-layer cycle
// =====================================================================

// The guard fires on a re-entry over a frame still in progress — a
// type cycle x -> y -> x INSIDE one layer: both anchors are visible
// through the own root, so the references resolve and the walk really
// re-enters. A pure self-reference is absorbed by the deduplication
// of the walk (measured below), it never reaches the guard.
const cyclicSpace = spaceFromLayerTrees({
  "model": {
    x: { refines: [new PathReference(asLayerName("model"), asLayerPath(["y"]))] },
    y: { refines: [new PathReference(asLayerName("model"), asLayerPath(["x"]))] },
  },
});
const guardedWalk = cyclicSpace.closure({ layer: asLayerName("model"), path: asLayerPath(["x"]) });
check(
  "O5 (measured): the guarded closure of model::x is finite and first — the re-entered way renders an empty list",
  guardedWalk.map(addressText).join(" ") === "model/x model/y",
);
check(
  "O5: the guard records its diagnostic on the re-entered address",
  cyclicSpace.diagnostics.some((diagnostic) => diagnostic.kind === "garde-de-cycle"),
);
check(
  "O17: the tainted frames (model::x and model::y) are not memoized",
  !cyclicSpace.closureMemo.has("model|x") && !cyclicSpace.closureMemo.has("model|y"),
);
check(
  "O17 (measured, the assumed consequence): outside any frame, the closure of model::y now includes model::x — the order of calls is observable on a cyclic space",
  cyclicSpace.closure({ layer: asLayerName("model"), path: asLayerPath(["y"]) }).map(addressText).join(" ") === "model/y model/x",
);

// The pure self-reference: absorbed by the deduplication, finite, and
// memoizable — its result depends on nothing (measured).
const selfRefSpace = spaceFromLayerTrees({
  "looped": { node: { refines: [new PathReference(asLayerName("looped"), asLayerPath(["node"]))] } },
});
const selfRefWalk = selfRefSpace.closure({ layer: asLayerName("looped"), path: asLayerPath(["node"]) });
check(
  "O5 (measured): a pure self-reference is absorbed by the deduplication — the guard never fires",
  selfRefWalk.map(addressText).join(" ") === "looped/node" && selfRefSpace.diagnostics.length === 0,
);
check(
  "O17 (measured): the unguarded self-reference closure is memoized like any other",
  selfRefSpace.closureMemo.has("looped|node"),
);

// =====================================================================
// O6 — LATE BINDING, on a dedicated written space
// =====================================================================

const lateBindingSpace = spaceFromWrittenSources([
  "layer holder\n  slot = @reader/extra\n  broken = @reader/nowhere\n",
  "layer reader refines @holder\n  extra = 42\n",
]);
check(
  "O6: a reference written in holder resolves in the reading layer — reader::slot reads 42",
  lateBindingSpace.read({ layer: asLayerName("reader"), path: asLayerPath([]), key: "slot" }) === 42,
);
check(
  "O6: an interrupted path resolves to null, never to an exception",
  lateBindingSpace.read({ layer: asLayerName("reader"), path: asLayerPath([]), key: "broken" }) === null,
);

// =====================================================================
// C5 — DESUGARING: O13 topological order, the measured ruling
// (implicits inherited by first winner), O12 idempotence
// =====================================================================

// model listed FIRST in the record: the topological order must still
// desugar base before model (O13).
const implicitsSpace = spaceFromLayerTrees({
  "model": { refines: [new LayerReference(asLayerName("base"))], c: {} },
  "base": { implicits: [new PathReference(asLayerName("base"), asLayerPath([]))], a: {}, b: {} },
});
const topological = layerTopologicalOrder(implicitsSpace).map(String);
check(
  "O13: the topological order places the source layer before the refining layer, whatever the insertion order",
  topological.indexOf("base") < topological.indexOf("model"),
);

const implicitEntry = new PathReference(asLayerName("base"), asLayerPath([]));
const refinesOf = (layerName: string, nodeName: string): unknown[] =>
  (layerTreeOf(implicitsSpace, layerName)[nodeName] as { refines?: unknown[] }).refines ?? [];

for (const layerName of topological) {
  desugarLayer({ space: implicitsSpace, layer: asLayerName(layerName) });
}
check(
  "C5: desugaring copies the implicits entry into every non-special child of the carrier",
  refinesOf("base", "a").length === 1 &&
    refinesOf("base", "b").length === 1 &&
    refinementEntriesEqual(refinesOf("base", "a")[0] as PathReference, implicitEntry),
);
check(
  "C5 (measured ruling §13): the implicits entry is inherited by first winner — the model child receives it too",
  refinesOf("model", "c").length === 1 &&
    refinementEntriesEqual(refinesOf("model", "c")[0] as PathReference, implicitEntry),
);

const beforeSecondPass: Record<string, unknown> = {};
for (const layerName of Object.keys(implicitsSpace.layers)) beforeSecondPass[layerName] = cloneTree(layerTreeOf(implicitsSpace, layerName));
for (const layerName of layerTopologicalOrder(implicitsSpace)) {
  desugarLayer({ space: implicitsSpace, layer: asLayerName(layerName) });
}
check(
  "C5 (O12): a second desugaring pass changes nothing",
  Object.keys(beforeSecondPass).every((layerName) =>
    rawTreesEqual(beforeSecondPass[layerName], layerTreeOf(implicitsSpace, layerName)),
  ),
);

// =====================================================================
// C7 — THE TOUCH PROTOCOL, on a dedicated mutable space
// =====================================================================

const mutableSpace = spaceFromLayerTrees({
  "scheme": { collection: { bound: 5 } },
  "model": { refines: [new LayerReference(asLayerName("scheme"))], collection: { own: 1 }, collection2: { own: 2 } },
});
const modelLayer = asLayerName("model");

// warm the memo: root, both collections
mutableSpace.closure({ layer: modelLayer, path: asLayerPath([]) });
mutableSpace.closure({ layer: modelLayer, path: asLayerPath(["collection"]) });
mutableSpace.closure({ layer: modelLayer, path: asLayerPath(["collection2"]) });
check(
  "C7/O16: before any write, nothing is stale",
  mutableSpace.staleMemoKeys().length === 0,
);

// addition: a brand-new path invalidates nothing
layerTreeOf(mutableSpace, "model")["fresh"] = { own: 3 };
mutableSpace.touch({ layer: modelLayer, path: asLayerPath(["fresh"]) });
check(
  "C7: the addition of a new path invalidates nothing (the protocol's zero-invalidation rule)",
  mutableSpace.staleMemoKeys().length === 0,
);

// value write on collection: exactly its own entry is invalidated
mutableSpace.touch({ layer: modelLayer, path: asLayerPath(["collection"]) });
const staleAfterWrite = mutableSpace.staleMemoKeys();
check(
  "C7: a value write on a node invalidates exactly the entries that depend on it",
  staleAfterWrite.includes("model|collection") &&
    !staleAfterWrite.includes("model|") &&
    !staleAfterWrite.includes("model|fresh"),
);
check(
  "C7 (segment boundary): the touch of `collection` never covers `collection2`",
  !staleAfterWrite.includes("model|collection2"),
);

// re-march: the recomputed closure equals the original walk (nothing
// structurally moved — C7's golden re-walk)
const recollection = mutableSpace.closure({ layer: modelLayer, path: asLayerPath(["collection"]) });
check(
  "C7: after the touch, the re-march of the closure is identical to the original",
  recollection.map(addressText).join(" ") === "model/collection scheme/collection",
);

// empty path: the whole layer is covered
mutableSpace.touch({ layer: modelLayer, path: [] });
const staleAfterLayer = mutableSpace.staleMemoKeys();
check(
  "C7: an empty-path touch covers the whole layer",
  staleAfterLayer.includes("model|collection") && staleAfterLayer.includes("model|collection2"),
);

// =====================================================================
// the built-in contracts (ADR-0109) — the algorithmic tags
// =====================================================================

// ADR-0109 retired the check-registry layer: first-order checks carry
// their formula inline. The algorithmic tags (strate 2) keep a
// built-in contract in the kernel.
const bedrockContracts = registryContractsOf();
check(
  "ADR-0109: the built-in contracts cover the algorithmic tags",
  Object.keys(bedrockContracts).join(",") === "containers,cardinality,oriented,dag,arbre,k-partite",
);

// every kernel algorithm has a built-in contract 1:1
check(
  "ADR-0109: every kernel algorithm has a built-in contract",
  Object.keys(checkRegistry).every((tag) => bedrockContracts[tag] !== undefined) &&
    Object.keys(bedrockContracts).length === Object.keys(checkRegistry).length,
);

// one source: the reading levels the dead-binding rule reads are
// derived from the data's contracts, never re-declared
const bedrockSlotContracts = checkSlotContractsOf(bedrockContracts);
check(
  "ADR-0102: the slot contracts derive from the data — one source",
  Object.keys(bedrockSlotContracts).every(
    (tag) =>
      JSON.stringify(bedrockSlotContracts[tag]) ===
      JSON.stringify(slotReadingLevelsOf(bedrockContracts[tag])),
  ),
);

// the bedrock corpus carries no vacant check: every carried tag can
// judge (measured: 79 contract judgments, 0 vacancies)
check(
  "ADR-0101: the bedrock corpus carries no vacant check — every carried tag can judge",
  vacantChecksOf({ space: bedrock, layerNames: [...KERNEL_LAYER_NAMES] }).length === 0,
);

// the built-in contract check: a variant bedrock is not needed —
// ADR-0109 moved the algorithmic contracts into the kernel, so the
// detector reads them from registryContractsOf() directly.
const variantSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [layerName, layerSources[layerName]]),
);
const variantTrunk = spaceFromSourcesMap(variantSources, KERNEL_LAYER_NAMES);
check(
  "ADR-0109: the variant bedrock (no registry layer) carries no vacant check",
  vacantChecksOf({ space: variantTrunk, layerNames: [...KERNEL_LAYER_NAMES] }).length === 0,
);


// =====================================================================
// the declarative strate (ADR-0105): the couples of hypergraph, judged
// by the reading interpreter, measured against the algorithmic strate
// — the same violations, address by address, on two probes written in
// the language. The witnesses are the free witnesses: the algorithmic
// strate breaks at the first finding (one verdict per cause), the
// declarative one ships EVERY falsified assignment — the comparison
// reads them as unordered SETS of witness keys, the symmetric pairs
// folding into one
// =====================================================================

// the corpus join, parsed and validated the way assembly does: the
// two couples pose and read, the validation stays silent (measured:
// 2 couples, 0 verdicts — the pose is well-formed)
const bedrockParsed = parseLanguage(
  KERNEL_LAYER_NAMES.map((layerName) => layerSources[layerName]).join(""),
);
const bedrockCompiled = compileLanguage(bedrockParsed.layers);
const bedrockValidated = validateSpace({
  space: bedrock,
  parse: bedrockParsed,
  compilation: bedrockCompiled,
  layerNames: [...KERNEL_LAYER_NAMES],
});
check(
  "ADR-0105/0027: the bedrock poses its three inline couples and the validation stays silent",
  bedrockValidated.stats.couples === 3 && bedrockValidated.verdicts.every((v) => v.kind === "déclaration-fantôme"),
);

// the two strates stay separate walks on the bedrock (measured: the
// algorithmic strate finds nothing to judge — the corpus is clean —
// and the declarative one agrees, without ever exhausting)
const bedrockAlgorithmic = spaceFromJoinOrder(KERNEL_LAYER_NAMES);
check(
  "ADR-0105: the bedrock's algorithmic judgments are unchanged — nothing to judge",
  KERNEL_LAYER_NAMES.every((layerName) => runChecks({ space: bedrockAlgorithmic, layer: layerName }).length === 0),
);
const bedrockDeclarative = spaceFromJoinOrder(KERNEL_LAYER_NAMES);
const bedrockFoJudgments = KERNEL_LAYER_NAMES.flatMap((layerName) =>
  runChecksFO({ space: bedrockDeclarative, layer: layerName }),
);
check(
  "ADR-0105: the bedrock's declarative strate agrees — no violation, no exhaustion",
  bedrockFoJudgments.length === 0 &&
    bedrockDeclarative.diagnostics.every(
      (diagnostic) => diagnostic.kind !== "formule-illisible" && diagnostic.kind !== "formule-épuisée",
    ),
);

// the unordered probe: e1 == e2 (same end-set — arête multiple), e3
// (the same vertex twice — sommet répété), e4 (no arrow — arête
// vide); the universe is the definer's vocabulary (vertices, edges,
// arrows, vertex)
const foProbeSource = [
  "layer fo-probe refines @hypergraph",
  "  extend vertices",
  "    v1 refines @fo-probe/specification/vertex_type",
  "      identifier = 1",
  "    v2 refines @fo-probe/specification/vertex_type",
  "      identifier = 2",
  "  extend edges",
  "    e1 refines @fo-probe/specification/edge_type",
  "      extend arrows",
  "        a1 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v1",
  "        a2 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v2",
  "    e2 refines @fo-probe/specification/edge_type",
  "      extend arrows",
  "        b1 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v1",
  "        b2 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v2",
  "    e3 refines @fo-probe/specification/edge_type",
  "      extend arrows",
  "        c1 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v1",
  "        c2 refines @fo-probe/specification/edge_type/arrow_type",
  "          vertex = @fo-probe/vertices/v1",
  "    e4 refines @fo-probe/specification/edge_type",
  "      identifier = 4",
].join("\n");

// the ordered probe: e1 == e2 (parallel arcs), e3 (a loop), e4 the
// reverse of e1 (a 2-cycle — LEGAL, the ordered pair differs); the
// arcs refine the family's own edge_type (multidigraph's idiom, where
// the source/target fields and their arrows live)
const foProbeOrderedSource = [
  "layer fo-probe-ordered refines @digraph",
  "  extend vertices",
  "    v1 refines @fo-probe-ordered/specification/vertex_type",
  "      identifier = 1",
  "    v2 refines @fo-probe-ordered/specification/vertex_type",
  "      identifier = 2",
  "  extend edges",
  "    e1 refines @digraph/edge_type",
  "      source = @fo-probe-ordered/vertices/v1",
  "      target = @fo-probe-ordered/vertices/v2",
  "    e2 refines @digraph/edge_type",
  "      source = @fo-probe-ordered/vertices/v1",
  "      target = @fo-probe-ordered/vertices/v2",
  "    e3 refines @digraph/edge_type",
  "      source = @fo-probe-ordered/vertices/v1",
  "      target = @fo-probe-ordered/vertices/v1",
  "    e4 refines @digraph/edge_type",
  "      source = @fo-probe-ordered/vertices/v2",
  "      target = @fo-probe-ordered/vertices/v1",
].join("\n");

/** The algorithmic strate's violations, counted per (address, tag) —
 * the error strings carry both, one per cause (the strate breaks at
 * the first finding). */
function tsViolationsOf({ space, layer }: { space: Space; layer: LayerName }): Map<string, number> {
  const counts = new Map<string, number>();
  for (const error of runChecks({ space, layer })) {
    const separator = error.indexOf(" — ");
    const address = error.slice(0, separator);
    const message = error.slice(separator + 3);
    const key = address + "|" + message.slice(0, message.indexOf(": "));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** The declarative strate's violations, counted per (address, tag) —
 * every falsified assignment ships; two assignments with the same
 * UNORDERED witness keys are ONE violation (the symmetric pairs, the
 * failed disjuncts of one same cause). */
function foViolationsOf({ space, layer }: { space: Space; layer: LayerName }): Map<string, number> {
  const witnesses = new Map<string, Set<string>>();
  for (const judgment of runChecksFO({ space, layer })) {
    const address = judgment.address[0] + "::" + (judgment.address[1].join("/") || ".");
    const key = address + "|" + judgment.tag;
    if (!witnesses.has(key)) witnesses.set(key, new Set());
    witnesses.get(key)!.add([...judgment.witnessKeys].sort().join(","));
    check(
      "ADR-0105: the declarative judgment carries its measured cost",
      judgment.steps > 0 && space.diagnostics.every((diagnostic) => diagnostic.kind !== "formule-épuisée"),
    );
  }
  return new Map([...witnesses.entries()].map(([key, set]) => [key, set.size]));
}

// the two probes, each on its OWN space per strate — the two walks
// record diagnostics on the space they read, never the same one twice
for (const [probeName, probeSource, expected] of [
  ["fo-probe", foProbeSource, { simple: 2, nonempty: 1 }],
  ["fo-probe-ordered", foProbeOrderedSource, { simple: 2, nonempty: 0 }],
] as const) {
  const probeOrder = [...KERNEL_LAYER_NAMES, probeName];
  const probeSources = { ...layerSources, [probeName]: probeSource };
  // ADR-0109: runChecks executes the inline couples directly. The
  // declarative walk counts UNIQUE witness sets per (address, tag) —
  // the symmetric pairs fold into one cause.
  const probeSpace = spaceFromSourcesMap(probeSources, probeOrder);
  const counts = foViolationsOf({ space: probeSpace, layer: asLayerName(probeName) });
  const where = probeName + "::.";
  check(
    "ADR-0105/0027: probe " + probeName + " — the inline formulas judge the expected causes",
    (counts.get(where + "|simple") ?? 0) === expected.simple &&
      (counts.get(where + "|nonempty") ?? 0) === expected.nonempty,
  );
}

// =====================================================================
// ADR-0106 — THE TWO-REGIME THEOREMS (specification §14): the
// guarantees mask and assume used to buy, measured now that no
// gesture can buy them — confluence (T1), conservativity (T2),
// monotony (T3)
// =====================================================================

// T1 — CONFLUENCE. (a) The census: zero leaf-value conflict anywhere
// on the bedrock — specificity is the only judge that ever fires,
// and no signature can hide one anymore (ADR-0100's census, a
// standing property since ADR-0106).
const confluentBedrock = spaceFromJoinOrder(KERNEL_LAYER_NAMES);
check(
  "T1 (confluence, the census): the bedrock carries zero leaf-value order conflicts — ADR-0100's census, now a standing property",
  orderConflictsOf({ space: confluentBedrock, layerNames: [...KERNEL_LAYER_NAMES] }).length === 0,
);

// (b) The divergence probe: two incomparable providers of one leaf —
// the dedicated space the corpus does not exercise (zero divergence
// was the census, one is the probe). The unsigned read falls back on
// the refines order — the order owns the determinism (O16), nothing
// else is left — and the lint inventories the convention; swapping
// the order swaps the read, never the inventory: no gesture can
// silence what no gesture blesses.
const branchSources = [
  "layer branch-a\n  new slot\n    value = 1\n",
  "layer branch-b\n  new slot\n    value = 2\n",
];
const forkAB = spaceFromWrittenSources([...branchSources, "layer fork refines @branch-a then @branch-b\n  extend slot\n"]);
const forkBA = spaceFromWrittenSources([...branchSources, "layer fork refines @branch-b then @branch-a\n  extend slot\n"]);
check(
  "T1 (confluence, the divergence probe): the unsigned read is deterministic — the refines order owns the fallback (O16): 1, then 2 the other way",
  forkAB.read({ layer: asLayerName("fork"), path: asLayerPath(["slot"]), key: "value" }) === 1 &&
    forkBA.read({ layer: asLayerName("fork"), path: asLayerPath(["slot"]), key: "value" }) === 2,
);
const forkInventoryOf = (space: Space) => orderConflictsOf({ space, layerNames: [asLayerName("fork")] });
check(
  "T1 (confluence, the divergence probe): both orders carry exactly one inventoried conflict — visible either way, never silenced",
  forkInventoryOf(forkAB).length === 1 && forkInventoryOf(forkBA).length === 1,
);
check(
  "T1 (confluence, the divergence probe): the inventory names the winner the order picked — the convention is observable, not blessed",
  String(forkInventoryOf(forkAB)[0].winner[0]) === "branch-a" && String(forkInventoryOf(forkBA)[0].winner[0]) === "branch-b",
);

// T2 — CONSERVATIVITY. For each layer L of the bedrock: L's posterity
// is the set of layers whose node, ANYWHERE in the tree,
// transitively designates L's branch (the anchors of the refines —
// node by node, not root by root: a positions refines @collection
// without its root descending from it). Removing L and its whole
// posterity must leave every address of every remaining layer
// untouched — closure, keys, reads — a space never disturbs the
// reading of the layers it does not descend into.
const layerDependencies = new Map<string, string[]>();
for (const layerName of KERNEL_LAYER_NAMES) {
  const dependencies: string[] = [];
  for (const [, node] of rawTreeWalk(layerTreeOf(bedrock, String(layerName)) as never)) {
    for (const entry of (node as { refines?: unknown[] }).refines ?? []) {
      if (entry instanceof LayerReference && String(entry.layer) !== String(layerName)) dependencies.push(String(entry.layer));
      if (entry instanceof PathReference && String(entry.anchor) !== String(layerName)) dependencies.push(String(entry.anchor));
    }
  }
  layerDependencies.set(String(layerName), dependencies);
}

/** L's posterity: every layer whose tree, transitively, designates L. */
function posterityOf(target: LayerName): Set<string> {
  const posterity = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const layerName of KERNEL_LAYER_NAMES) {
      const name = String(layerName);
      if (name === String(target) || posterity.has(name)) continue;
      const dependencies = layerDependencies.get(name) ?? [];
      if (dependencies.some((dependency) => dependency === String(target) || posterity.has(dependency))) {
        posterity.add(name);
        grew = true;
      }
    }
  }
  return posterity;
}

let conservativityComparisons = 0;
let conservativityDisturbances = 0;
for (const removed of KERNEL_LAYER_NAMES) {
  const posterity = posterityOf(removed);
  const outside = KERNEL_LAYER_NAMES.filter((name) => name !== removed && !posterity.has(String(name)));
  if (outside.length === 0) continue;
  const branchless = spaceFromJoinOrder(outside);
  for (const layerName of outside) {
    for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
      const [layer, path] = address;
      conservativityComparisons++;
      if (branchless.closure({ layer, path }).map(addressText).join(" ") !== bedrock.closure({ layer, path }).map(addressText).join(" ")) {
        conservativityDisturbances++;
        continue;
      }
      const keptKeys = branchless.keys({ layer, path });
      if (keptKeys.join("\u0001") !== bedrock.keys({ layer, path }).join("\u0001")) {
        conservativityDisturbances++;
        continue;
      }
      for (const key of keptKeys) {
        if (valueText(branchless.read({ layer, path, key })) !== valueText(bedrock.read({ layer, path, key }))) {
          conservativityDisturbances++;
          break;
        }
      }
    }
  }
}
check(
  "T2 (conservativity): removing any layer with its whole posterity disturbs nothing outside — closures, keys, reads identical (measured: 0 disturbances)",
  conservativityDisturbances === 0,
);

// T3 — MONOTONY. Growing the assembly from the most recent layers up
// — each arrival an ancestor or an incomparable, never a descendant —
// can only grow the enumeration: at every old address every key
// survives (an arrival may MOVE a key — its first provider changes —
// never remove one).
const assemblyOrder = layerTopologicalOrder(bedrock);
let monotonyComparisons = 0;
let monotonyRemovals = 0;
for (let step = 1; step < assemblyOrder.length; step++) {
  const present = assemblyOrder.slice(step);
  const grown = assemblyOrder.slice(step - 1);
  const smallSpace = spaceFromJoinOrder(present);
  const bigSpace = spaceFromJoinOrder(grown);
  for (const layerName of present) {
    for (const address of walkAddresses({ space: smallSpace, layer: asLayerName(layerName) })) {
      monotonyComparisons++;
      const kept = new Set(bigSpace.keys({ layer: address[0], path: address[1] }));
      if (!smallSpace.keys({ layer: address[0], path: address[1] }).every((key) => kept.has(key))) monotonyRemovals++;
    }
  }
}
check(
  "T3 (monotony): growing the assembly can only grow the enumeration — no arrival removes a key at any old address (measured: 0 removals)",
  monotonyRemovals === 0,
);

// T3's couple clause — the mechanism: a check couple is never
// replaced. The probe space carries the registry as data
// (check-registry, ADR-0102 — the same route as the bedrock) and a
// couple on « containers », the generic tag with no required slot:
// the identical re-pose is tolerated — the original survives, the
// validation stays silent; the divergent re-pose is a verdict at
// assembly — a replacement never lands. Nothing else writes
// check-definitions, so nothing else can remove one.
const coupleSources = [
  "layer couple-base\n",
  "  new slot\n",
  "    value = 1\n",
  "  check containers\n",
  "    level = \"root\"\n",
  "    judgment\n",
  "      formula = \"forall s in slot: s/value\"\n",
  "      message = \"containers: slot sans valeur ({s})\"\n",
];
const coupleHeirSource = (formula: string, message: string): string =>
  [
    "layer couple-heir refines @couple-base\n",
    "  check containers\n",
    "    level = \"root\"\n",
    "    judgment\n",
    "      formula = \"" + formula + "\"\n",
    "      message = \"" + message + " ({s})\"\n",
  ].join("");

/** The validation of a written multi-layer space — the assembly's own
 * walk: parse, compile, validate. */
function validateWrittenSources(sources: readonly string[]) {
  const joined = sources.map((source) => (source.endsWith("\n") ? source : source + "\n")).join("");
  const parse = parseLanguage(joined);
  const compilation = compileLanguage(parse.layers);
  const space = new Space(compilation.layers);
  const layerNames = Object.keys(compilation.layers).map(asLayerName);
  return validateSpace({ space, parse, compilation, layerNames });
}

const identicalRePose = validateWrittenSources([
  layerSources["record"],
  ...coupleSources,
  coupleHeirSource("forall s in slot: s/value", "containers: slot sans valeur"),
]);
check(
  "T3 (monotony, the couple clause): the identical re-pose is tolerated — the original couple survives (measured: 2 poses), the validation stays silent",
  identicalRePose.verdicts.length === 0 && identicalRePose.stats.couples === 2,
);
const divergentRePose = validateWrittenSources([
  layerSources["record"],
  ...coupleSources,
  coupleHeirSource("forall s in slot: not s/value", "containers: autre lecture"),
]);
check(
  "T3 (monotony, the couple clause): the divergent re-pose is refused at assembly — « check-redéfini », a replacement never lands",
  divergentRePose.verdicts.filter((verdict) => verdict.kind === "check-redéfini").length === 1,
);

// =====================================================================
// the ledger
// =====================================================================

console.log("specification properties: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
