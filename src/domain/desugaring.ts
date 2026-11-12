// Desugaring: topological ordering + implicits copying.
//
// The mechanism lives OUTSIDE the Space class on purpose: the kernel
// stays a reading machine, and rewriting the copied implicits is a
// pass driven from the outside (the callers drive it; the
// workbench reads the space immutably).

import { type LayerName, type LayerPath, asPathSegment } from "./identifiers.ts";
import {
  type Address,
  LayerReference,
  PathReference,
  type RawTree,
  type RawValue,
  isDictionary,
} from "./addresses.ts";
import { SPECIAL_KEYS } from "./specialKeys.ts";
import { Space } from "./space.ts";

// Topological order of the layers (acyclic refinements) — implicits
// can only bind after their sources.
export function layerTopologicalOrder(space: Space): LayerName[] {
  const order: LayerName[] = [];
  const seen = new Set<string>();
  const visit = (name: LayerName): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const refinements = space.layers[name]?.["refines"] ?? [];
    if (Array.isArray(refinements)) {
      for (const entry of refinements) {
        if (entry instanceof LayerReference) visit(entry.layer);
      }
    }
    order.push(name);
  };
  for (const name of Object.keys(space.layers)) visit(name as LayerName);
  return order;
}

// Pre-order walk of one layer's raw tree: (path, node) pairs, keys in
// insertion order — mirror of the original `walk_raw`.
export function rawTreeWalk(node: RawTree, path: LayerPath = []): [LayerPath, RawTree][] {
  const output: [LayerPath, RawTree][] = [[path, node]];
  for (const key of Object.keys(node)) {
    if (isDictionary(node[key]))
      output.push(...rawTreeWalk(node[key], [...path, asPathSegment(key)]));
  }
  return output;
}

// Equality of refinement entries (references or scalars) — used to
// deduplicate while desugaring; structural equality of the references.
export function refinementEntriesEqual(first: RawValue, second: RawValue): boolean {
  if (first instanceof PathReference && second instanceof PathReference) {
    return (
      first.anchor === second.anchor && first.path.join("\u0001") === second.path.join("\u0001")
    );
  }
  if (first instanceof LayerReference && second instanceof LayerReference) {
    return first.layer === second.layer;
  }
  return first === second;
}

// Desugaring: copies the `implicits` entry (unresolved — late binding
// preserved) into the raw tree of every non-special child of each node
// whose view exposes an implicits value. Idempotent — port of the
// original `desugar`. This is the only place outside the journal where
// raw trees are mutated, because the mechanism IS a rewrite.
export function desugarLayer({ space, layer }: { space: Space; layer: LayerName }): void {
  const tree = space.layers[layer];
  if (tree === undefined) return;
  const snapshot = rawTreeWalk(tree);
  for (const [path, node] of snapshot) {
    const children = Object.keys(node).filter(
      (key) => !(SPECIAL_KEYS as readonly string[]).includes(key) && isDictionary(node[key]),
    );
    if (!children.length) continue;
    const implicits = space.rawValue({ layer, path, key: "implicits" });
    if (!implicits) continue;
    const entries: RawValue[] = Array.isArray(implicits) ? implicits : [implicits];
    if (!entries.length) continue; // like the original: an empty list is nothing
    for (const childKey of children) {
      const child = node[childKey] as RawTree;
      if (!("refines" in child)) child["refines"] = [];
      const refinements = child["refines"] as RawValue[];
      for (const entry of entries) {
        if (!refinements.some((existing) => refinementEntriesEqual(existing, entry))) {
          refinements.push(entry);
        }
      }
    }
  }
}

// The concrete node designated by an address: the first source of its
// closure (the own raw node if it exists, else the first ancestor).
export function designatedAddress({
  space,
  layer,
  path,
}: {
  space: Space;
  layer: LayerName;
  path: LayerPath;
}): Address | null {
  const sources = space.closure({ layer, path });
  return sources.length ? (sources[0] ?? null) : null;
}
