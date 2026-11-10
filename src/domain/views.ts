// The views module: the space's observable views (closures, keys,
// reads, lens entries, drawn reads, applicability). Everything here
// is a PURE OBSERVATION of the space: nothing is written, no verdict
// changes.
//
// Three consumers read through this module:
//   - the drawing panels (the lens shapes of the glyphs);
//   - the audit harness (the walk of the observable reads);
//   - the validator and the checks (walkAddresses).

import { type LayerName, type LayerPath, asPathSegment } from "./identifiers.ts";
import {
  type Address,
  type RawTree,
  AddressView,
  LayerReference,
  PathReference,
  addressesEqual,
  isDictionary,
} from "./addresses.ts";
import { Space } from "./space.ts";

/** One walked address, observed ONCE: the address, its visible keys,
 * its closure, and the raw node of every closure source (aligned by
 * index — nodes[i] is the node of closure[i]). The validator's passes
 * share this observation instead of re-walking and re-reading the
 * same space four times: the walk is the expensive part of the
 * validation, the passes only judge. */
export interface WalkedAddress {
  address: Address;
  keys: string[];
  closure: Address[];
  nodes: (RawTree | null)[];
}

/** The observed walk of one layer: walkAddresses, plus the keys and
 * the closure/nodes of every address, captured during the single
 * walk. The address order is walkAddresses' order (byte-identical):
 * the root first, children in stack order. */
export function walkLayerObserved({
  space,
  layer,
}: {
  space: Space;
  layer: LayerName;
}): WalkedAddress[] {
  const output: WalkedAddress[] = [];
  const stack: Address[] = [[layer, []]];
  while (stack.length) {
    const top = stack.pop()!;
    const [walkLayer, walkPath] = top;
    const nodes: (RawTree | null)[] = [];
    const keys = space.keys({ layer: walkLayer, path: walkPath, nodes });
    const closure = space.closure({ layer: walkLayer, path: walkPath });
    output.push({ address: top, keys, closure, nodes });
    for (const key of keys) {
      const value = space.read({ layer: walkLayer, path: walkPath, key });
      if (value instanceof AddressView && value.layer === walkLayer) {
        stack.push([walkLayer, [...walkPath, asPathSegment(key)]]);
      }
    }
  }
  return output;
}

/** One lens drawing entry: where the template lives, and which types
 * it dresses (concrete closure sources — never the layer roots,
 * never a node carrying a display of its own). */
export interface LensDrawingEntry {
  path: LayerPath;
  spec: any;
  types: Address[];
}

/** The shape drawn for one node: the winning entry and the types it
 * matched on the node's chain. */
export interface DrawnShape {
  spec: any;
  hit: Address[];
}

// Addresses candidates for a display entry: first level + specification.
export function displayCandidatePaths({
  space,
  lens,
}: {
  space: Space;
  lens: LayerName;
}): LayerPath[] {
  const paths: LayerPath[] = [];
  for (const key of space.keys({ layer: lens, path: [] })) paths.push([asPathSegment(key)]);
  for (const key of space.keys({ layer: lens, path: [asPathSegment("specification")] })) {
    paths.push([asPathSegment("specification"), asPathSegment(key)]);
  }
  return paths;
}

// Raw display template at the first defining source (not via read():
// a dict value there comes back as a value view).
export function readDisplayTemplate({
  space,
  lens,
  path,
}: {
  space: Space;
  lens: LayerName;
  path: LayerPath;
}): any {
  for (const [sourceLayer, sourcePath] of space.closure({ layer: lens, path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (isDictionary(node) && "display" in node) {
      if ((node as any)["display"] !== null) return (node as any)["display"];
    }
  }
  return null;
}

// Drawing entries: (path, template, dressed types) — the dressed
// types are the closure sources with the same final segment, never
// the layer roots, never a node carrying a display of its own.
export function lensDrawingEntries({
  space,
  lens,
}: {
  space: Space;
  lens: LayerName;
}): LensDrawingEntry[] {
  const entries: LensDrawingEntry[] = [];
  for (const path of displayCandidatePaths({ space, lens })) {
    const spec = readDisplayTemplate({ space, lens, path });
    if (spec === null) continue;
    const types: Address[] = [];
    for (const source of space.closure({ layer: lens, path })) {
      const [sourceLayer, sourcePath] = source;
      if (
        (sourceLayer === lens && sourcePath.join("/") === path.join("/")) ||
        sourcePath.length === 0 ||
        sourcePath[sourcePath.length - 1] !== path[path.length - 1]
      ) {
        continue;
      }
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (isDictionary(node) && "display" in node) continue;
      if (!types.some((existing) => addressesEqual(existing, source))) types.push(source);
    }
    entries.push({ path, spec, types });
  }
  return entries;
}

// Does the first address list cover the second (each covering type
// has the second list inside its closure)?
export function coversAddresses({
  space,
  covering,
  covered,
}: {
  space: Space;
  covering: Address[];
  covered: Address[];
}): boolean {
  for (const coveringAddress of covering) {
    const closure = space.closure({ layer: coveringAddress[0], path: coveringAddress[1] });
    for (const coveredAddress of covered) {
      if (closure.some((member) => addressesEqual(member, coveredAddress))) return true;
    }
  }
  return false;
}

// The entries dressing one node (in the harness order).
export function dressingEntries({
  space,
  lens,
  layer,
  path,
}: {
  space: Space;
  lens: LayerName;
  layer: LayerName;
  path: LayerPath;
}): { path: LayerPath; spec: any; hit: Address[] }[] {
  const chain = space.closure({ layer, path });
  const matches: { path: LayerPath; spec: any; hit: Address[] }[] = [];
  for (const entry of lensDrawingEntries({ space, lens })) {
    const hit = entry.types.filter((type) => chain.some((member) => addressesEqual(member, type)));
    if (hit.length) matches.push({ path: entry.path, spec: entry.spec, hit });
  }
  return matches;
}

// Drawn read: the most specific of the dressing entries wins —
// measured by closure, independently of the chain order (think1
// carries its most specific type at the end of the chain, producer
// at the beginning).
export function drawnShape({
  space,
  lens,
  layer,
  path,
}: {
  space: Space;
  lens: LayerName;
  layer: LayerName;
  path: LayerPath;
}): DrawnShape | null {
  let best: { path: LayerPath; spec: any; hit: Address[] } | null = null;
  for (const match of dressingEntries({ space, lens, layer, path })) {
    if (best === null || coversAddresses({ space, covering: match.hit, covered: best.hit })) {
      best = match;
    }
  }
  return best;
}

// Drawn read through a viewpoint — the (model, viewpoint) pair:
// model/display read at the viewpoint root, late binding of the
// layer references.
export function viewShape({
  space,
  view,
  path,
}: {
  space: Space;
  view: LayerName;
  path: LayerPath;
}): DrawnShape | null {
  const model = space.read({ layer: view, path: [], key: "model" });
  const lens = space.read({ layer: view, path: [], key: "display" });
  if (!(model instanceof AddressView) || !(lens instanceof AddressView)) return null;
  return drawnShape({ space, lens: lens.layer, layer: model.layer, path });
}

// Mirror of the domain check check_view_lens: how many vertices of
// the model does the lens dress?
export function dressingApplicability({
  space,
  lens,
  model,
}: {
  space: Space;
  lens: LayerName;
  model: LayerName;
}): { dressed: number; total: number } {
  const vertices = space.read({ layer: model, path: [], key: "vertices" });
  if (!(vertices instanceof AddressView)) return { dressed: -1, total: -1 };
  const vertexKeys = space.keys({ layer: model, path: vertices.path });
  let dressed = 0;
  for (const vertexKey of vertexKeys) {
    if (
      drawnShape({
        space,
        lens,
        layer: model,
        path: [...vertices.path, asPathSegment(vertexKey)],
      }) !== null
    ) {
      dressed++;
    }
  }
  return { dressed, total: vertexKeys.length };
}

// ---- serialization helpers -------------------------------------------
// Comparable serialization (same conventions as the harness:
// __ref, __lref, __addr) — driver-independent, so the kernel
// stays testable without one.

export function serializableValue(value: any): any {
  if (value instanceof PathReference) return { __ref: [value.anchor, ...value.path] };
  if (value instanceof LayerReference) return { __lref: value.layer };
  if (Array.isArray(value)) return value.map(serializableValue);
  if (isDictionary(value)) {
    const serialized: any = {};
    for (const key of Object.keys(value)) serialized[key] = serializableValue(value[key]);
    return serialized;
  }
  return value;
}

export function normalizedValue(value: any): any {
  if (value instanceof AddressView) return { __addr: [value.layer, value.path] };
  return serializableValue(value);
}

// Deep clone of a layers value (references recreated: two spaces
// share nothing).
export function deepCloneValue(value: any): any {
  if (value instanceof PathReference) return new PathReference(value.anchor, [...value.path]);
  if (value instanceof LayerReference) return new LayerReference(value.layer);
  if (Array.isArray(value)) return value.map(deepCloneValue);
  if (isDictionary(value)) {
    const clone: any = {};
    for (const key of Object.keys(value)) clone[key] = deepCloneValue(value[key]);
    return clone;
  }
  return value;
}

// ---- the walk of the observable reads ---------------------------------

// LIFO walk of one layer (same idiom as the original walk_addresses:
// one descends only into the views of this layer).
export function walkAddresses({ space, layer }: { space: Space; layer: LayerName }): Address[] {
  const output: Address[] = [];
  const stack: Address[] = [[layer, []]];
  while (stack.length) {
    const top = stack.pop()!;
    output.push(top);
    const [walkLayer, walkPath] = top;
    for (const key of space.keys({ layer: walkLayer, path: walkPath })) {
      const value = space.read({ layer: walkLayer, path: walkPath, key });
      if (value instanceof AddressView && value.layer === walkLayer) {
        stack.push([walkLayer, [...walkPath, asPathSegment(key)]]);
      }
    }
  }
  return output;
}

// One golden entry: closure, keys, reads — the unit of measurement. The
// audit harness consumes it; the workbench itself reads the space
// through the panels.
export function fullObservation({ space, address }: { space: Space; address: Address }): any {
  const closure = space.closure({ layer: address[0], path: address[1] });
  const keys = space.keys({ layer: address[0], path: address[1] });
  const reads: any = {};
  for (const key of keys) {
    reads[key] = normalizedValue(space.read({ layer: address[0], path: address[1], key }));
  }
  return { closure, keys, reads };
}
