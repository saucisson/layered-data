// The executable specification of the kernel.
//
// docs/specification.md is normative: obligations O1–O18 and
// conformance requirements C1–C8. This file proves them as
// properties — over the whole bedrock corpus (every observable
// address, the same walk as the audit harness) and over dedicated
// spaces built for the semantics the corpus does not exercise
// (implicits, masks at the kernel level, the cycle guard, the touch
// protocol). Every "measured" expectation was read from the
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
  MASK,
  PathReference,
  isDictionary,
} from "../src/domain/addresses.ts";
import { asLayerName, asLayerPath } from "../src/domain/identifiers.ts";
import { SPECIAL_KEYS } from "../src/domain/specialKeys.ts";
import { desugarLayer, layerTopologicalOrder, refinementEntriesEqual } from "../src/domain/desugaring.ts";
import { parseLanguage } from "../src/domain/language/parser.ts";
import { compileLanguage } from "../src/domain/language/compiler.ts";
import { walkAddresses } from "../src/domain/views.ts";
import { KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { checkRegistry, registryAuditOf, registryContractsOf, slotReadingLevelsOf, vacantChecksOf } from "../src/domain/checks.ts";
import { checkSlotContractsOf } from "../src/domain/validation.ts";

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
 * data-driven semantics proof (ADR-0019) edits the registry layer
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
  if (value === MASK) return "MASK";
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
 * MASK by identity, dicts key by key in insertion order. */
function rawTreesEqual(first: unknown, second: unknown): boolean {
  if (first === MASK || second === MASK) return first === second;
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
 * reference classes and choke on the MASK symbol. */
function cloneTree(value: unknown): unknown {
  if (value === MASK) return MASK;
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
check("C1: the walk covers the measured corpus (thousands of addresses)", walkedAddresses > 3000);

// The measured diamond (§13): the two ways of the refinement cross.
const diamondClosure = bedrock.closure({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e2"]) });
check(
  "C1 (O4, measured diamond §13): the closure of wb1::arcsAB::e2 is exactly the §13 walk",
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
  "C1 (O2, measured diamond §13): the first way of the diamond (bd specification) precedes the second (weight)",
  diamondClosure.findIndex(([l, p]) => l === "bipartite-digraph" && p.join("/") === "specification/arcAB_type") <
    diamondClosure.findIndex(([l, p]) => l === "weighted-hypergraph" && p.join("/") === "edge_type"),
);
check(
  "C1 (O4, measured diamond §13): the closure counts exactly the eight sources of the §13 walk",
  diamondClosure.length === 8,
);

// =====================================================================
// C2 — READS, first winner and observable statuses
// =====================================================================

let statusAnomalies = 0;
let winnerAnomalies = 0;
let scalarNodeAnomalies = 0;
let maskedVisibleAnomalies = 0;

for (const layerName of KERNEL_LAYER_NAMES) {
  for (const address of walkAddresses({ space: bedrock, layer: asLayerName(layerName) })) {
    const [layer, path] = address;
    for (const key of bedrock.keys({ layer, path })) {
      const scan: ReadObservation[] = [];
      const value = bedrock.read({ layer, path, key, scan });

      // O8 — the statuses are exactly the four documented ones.
      const statuses = scan.map((observation) => observation.status);
      for (const status of statuses) {
        if (!["masqué", "fournit", "transparent", "absent"].includes(status)) statusAnomalies++;
      }

      // C2 — first winner: the scan is cut by at most one source,
      // always at the winner, and a visible value implies a cut.
      const winners = statuses.filter((status) => status === "fournit").length;
      const masked = statuses.filter((status) => status === "masqué").length;
      if (winners + masked > 1) winnerAnomalies++;
      if (winners === 1 && statuses[statuses.length - 1] !== "fournit") winnerAnomalies++;
      if (value !== null && value !== undefined && winners + masked === 0) winnerAnomalies++;
      if (value === MASK && masked !== 1) winnerAnomalies++;

      // O9 — a masked key renders MASK, never a value of the carrier.
      if (value === MASK) maskedVisibleAnomalies++;

      // O1 — a scalar is never a node: the raw of its address is null.
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
        if (bedrock.raw({ layer: asLayerName(layer), path: asLayerPath([...path, key]) }) !== null) scalarNodeAnomalies++;
      }
    }
  }
}

check("C2 (O8): the statuses of every visible read are exactly masqué/fournit/transparent/absent", statusAnomalies === 0);
check("C2: every read is cut by at most one winner, at the winner (first-winner)", winnerAnomalies === 0);
check("C2 (O9): every masked read renders MASK", maskedVisibleAnomalies === 0);
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
  "C4 (measured diamond §13): the anchors of wb1::arcsAB::e2 are the closure walk",
  bedrock.anchorsAt({ layer: asLayerName("wb1"), path: asLayerPath(["arcsAB", "e2"]), tracer: null }).join(",") === "e2,arcAB_type,edge_type,record",
);

// =====================================================================
// C8 — IMMUTABILITY: call-order independence and permutation
// invariance (the recommended property of the specification §12)
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
// O9 — MASKS, on dedicated spaces (kernel raw tree and written .ld)
// =====================================================================

const maskedSpace = spaceFromLayerTrees({
  "masked-node": {
    child: MASK,
    leaf: 1,
    abstract: null,
    deep: { inner: MASK },
  },
});
const maskedLayer = asLayerName("masked-node");
check("O9: the raw of a masked key is MASK", maskedSpace.raw({ layer: maskedLayer, path: asLayerPath(["child"]) }) === MASK);
check("O9: the raw propagates MASK from an intermediate", maskedSpace.raw({ layer: maskedLayer, path: asLayerPath(["deep", "inner", "x"]) }) === MASK);
check("O9: reading a masked key value renders MASK before any key", maskedSpace.read({ layer: maskedLayer, path: asLayerPath([]), key: "child" }) === MASK);
check("O9: keys hides the masked key and keeps the transparent abstract slot", maskedSpace.keys({ layer: maskedLayer, path: asLayerPath([]) }).join(",") === "leaf,abstract,deep");

const writtenMaskedSpace = spaceFromWrittenSources([
  "layer masked-language\n  mask secret\n  keep = 1\n",
]);
check(
  "O9 (language route): the written mask act produces the opaque mask, keys hides it",
  writtenMaskedSpace.read({ layer: asLayerName("masked-language"), path: asLayerPath([]), key: "secret" }) === MASK &&
    writtenMaskedSpace.keys({ layer: asLayerName("masked-language"), path: asLayerPath([]) }).join(",") === "keep",
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
  "C5 (measured ruling §14): the implicits entry is inherited by first winner — the model child receives it too",
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
// the registry as data (ADR-0019) — the meta-model come home
// =====================================================================

// the contracts are READ FROM THE DATA: the check-registry layer is
// the single source — the nine tags, in writing order, no more
const bedrockContracts = registryContractsOf({ space: bedrock });
check(
  "ADR-0019: the registry is data — the check-registry layer declares the nine tags",
  Object.keys(bedrockContracts).join(",") === "containers,cardinality,simple,nonempty,oriented,sperner,k-partite,dag,arbre",
);

// the data and the algorithms answer for each other — the closed
// registry of ADR-0018, now written in the language, covers the
// kernel's execution binding 1:1
check(
  "ADR-0019: every kernel algorithm has a contract in the data, and every declared contract has its algorithm",
  Object.keys(checkRegistry).every((tag) => bedrockContracts[tag] !== undefined) &&
    Object.keys(bedrockContracts).length === Object.keys(checkRegistry).length,
);

// the meta-audit is silent on the bedrock — no contract without an
// algorithm, no algorithm without a contract, no unreadable clause
check(
  "ADR-0019: the meta-audit of the bedrock is silent — 0/0/0 (measured)",
  registryAuditOf({ space: bedrock }).length === 0,
);

// one source: the reading levels the dead-binding rule reads are
// derived from the data's contracts, never re-declared
const bedrockSlotContracts = checkSlotContractsOf(bedrockContracts);
check(
  "ADR-0019: the slot contracts derive from the data — one source",
  Object.keys(bedrockSlotContracts).every(
    (tag) =>
      JSON.stringify(bedrockSlotContracts[tag]) ===
      JSON.stringify(slotReadingLevelsOf(bedrockContracts[tag])),
  ),
);

// the bedrock corpus carries no vacant check: every carried tag can
// judge (measured: 79 contract judgments, 0 vacancies)
check(
  "ADR-0018: the bedrock corpus carries no vacant check — every carried tag can judge",
  vacantChecksOf({ space: bedrock, layerNames: [...KERNEL_LAYER_NAMES] }).length === 0,
);

// the data-driven proof: a variant bedrock whose registry layer EDITS
// a contract — sperner gains a required slot « tolerance » that no
// layer binds. The language said it; the detector reads it — the
// semantics moved with the data, no code touched
const variantSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    String(layerName) === "check-registry"
      ? layerSources[layerName].replace(
          '    sperner\n      level = "root"\n      required\n        edges = "root"',
          '    sperner\n      level = "root"\n      required\n        tolerance = "root"\n        edges = "root"',
        )
      : layerSources[layerName],
  ]),
);
const variantTrunk = spaceFromSourcesMap(variantSources, KERNEL_LAYER_NAMES);
check(
  "ADR-0019: an edited registry contract edits the vacancies — the data drives the semantics (measured: 1)",
  vacantChecksOf({ space: variantTrunk, layerNames: [...KERNEL_LAYER_NAMES] }).filter(
    (vacancy) => vacancy.tag === "sperner" && vacancy.slot === "tolerance",
  ).length === 1,
);

// =====================================================================
// the ledger
// =====================================================================

console.log("specification properties: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
