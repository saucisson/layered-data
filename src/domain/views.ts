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

/** One glyph of the closed drawing vocabulary, discriminated by
 * `shape` — the corpus's display templates carry exactly these
 * fields (see formalisms/kernel/*-display.ld). Vertex glyphs are
 * circle/ellipse/rectangle/box; the edge glyph is line. */
export type Glyph =
  | { shape: "circle"; fill?: string; stroke?: string; label?: string }
  | { shape: "ellipse"; fill?: string; stroke?: string; label?: string }
  | { shape: "rectangle"; fill?: string; stroke?: string; label?: string }
  | { shape: "box"; fill?: string; stroke?: string; label?: string }
  | { shape: "line"; arrow?: string; ports?: number; stroke?: string };

/** Narrow a raw display template to a glyph — unknown shapes and
 * non-dictionary values are not glyphs (the entry is then skipped,
 * never a crash). */
export function asGlyph(value: unknown): Glyph | null {
  if (!isDictionary(value)) return null;
  const shape = value["shape"];
  if (shape === "circle" || shape === "ellipse" || shape === "rectangle" || shape === "box") {
    const glyph: { shape: typeof shape; fill?: string; stroke?: string; label?: string } = {
      shape,
    };
    if (typeof value["fill"] === "string") glyph.fill = value["fill"];
    if (typeof value["stroke"] === "string") glyph.stroke = value["stroke"];
    if (typeof value["label"] === "string") glyph.label = value["label"];
    return glyph;
  }
  if (shape === "line") {
    const glyph: { shape: "line"; arrow?: string; ports?: number; stroke?: string } = {
      shape: "line",
    };
    if (typeof value["arrow"] === "string") glyph.arrow = value["arrow"];
    if (typeof value["ports"] === "number") glyph.ports = value["ports"];
    if (typeof value["stroke"] === "string") glyph.stroke = value["stroke"];
    return glyph;
  }
  return null;
}

/** Narrow a raw display template to its ordered list of glyphs. A
 * single-glyph template (`display` with direct fields) yields a
 * one-element list; a multi-glyph template poses a `glyphs` sub-block
 * whose members are the overlaid glyphs, in the order written
 * (insertion order — the compiler preserves it); a raw array (the
 * kernel-level form) is read item by item. Invalid glyphs are
 * dropped, never a crash. */
export function asGlyphList(value: unknown): Glyph[] {
  if (isDictionary(value)) {
    const glyphsBlock = value["glyphs"];
    if (isDictionary(glyphsBlock)) {
      const glyphs: Glyph[] = [];
      for (const key of Object.keys(glyphsBlock)) {
        const glyph = asGlyph(glyphsBlock[key]);
        if (glyph !== null) glyphs.push(glyph);
      }
      return glyphs;
    }
    const glyph = asGlyph(value);
    return glyph === null ? [] : [glyph];
  }
  if (Array.isArray(value)) {
    const glyphs: Glyph[] = [];
    for (const item of value) {
      const glyph = asGlyph(item);
      if (glyph !== null) glyphs.push(glyph);
    }
    return glyphs;
  }
  return [];
}

/** A display guard, narrowed from its raw form — strate 1: presence
 * of a key path on the dressed node, or membership in a closed set.
 * No comparisons (strate 2 is a declared next strate). */
export type DisplayGuard =
  | { kind: "presence"; path: string[] }
  | { kind: "member"; path: string[]; values: unknown[] };

/** Narrow a raw `__when:display` value to a guard — anything else is
 * no guard (the entry is then the unguarded default). */
export function asDisplayGuard(value: unknown): DisplayGuard | null {
  if (!isDictionary(value)) return null;
  const kind = value["kind"];
  const path = value["path"];
  if (!Array.isArray(path) || !path.every((segment) => typeof segment === "string")) {
    return null;
  }
  const guardPath = path as string[];
  if (kind === "presence") return { kind: "presence", path: guardPath };
  if (kind === "member") {
    const values = value["values"];
    if (!Array.isArray(values)) return null;
    return { kind: "member", path: guardPath, values };
  }
  return null;
}

/** One lens drawing entry: where the template lives, which types it
 * dresses (concrete closure sources — never the layer roots, never a
 * node carrying a display of its own), and its optional guard. */
export interface LensDrawingEntry {
  path: LayerPath;
  spec: Glyph[];
  types: Address[];
  guard: DisplayGuard | null;
}

/** The shape drawn for one node: the winning entry and the types it
 * matched on the node's chain. */
export interface DrawnShape {
  spec: Glyph[];
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
// a dict value there comes back as a value view), narrowed to its
// ordered list of glyphs.
export function readDisplayTemplate({
  space,
  lens,
  path,
}: {
  space: Space;
  lens: LayerName;
  path: LayerPath;
}): Glyph[] | null {
  for (const [sourceLayer, sourcePath] of space.closure({ layer: lens, path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (isDictionary(node) && "display" in node) {
      const display = node["display"];
      if (display !== null) return asGlyphList(display);
    }
  }
  return null;
}

// Raw display guard at the first defining source (the `__when:display`
// sibling of the display template).
export function readDisplayGuard({
  space,
  lens,
  path,
}: {
  space: Space;
  lens: LayerName;
  path: LayerPath;
}): DisplayGuard | null {
  for (const [sourceLayer, sourcePath] of space.closure({ layer: lens, path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (isDictionary(node) && "__when:display" in node) {
      const guard = asDisplayGuard(node["__when:display"]);
      if (guard !== null) return guard;
    }
  }
  return null;
}

// Drawing entries: one per (candidate path, closure source carrying a
// display) — the closure order is child-first, so a lens child's
// entries precede its parent's (ADR-0100). The dressed types are the
// closure sources with the same final segment, never the layer roots,
// never a node carrying a display of its own.
export function lensDrawingEntries({
  space,
  lens,
}: {
  space: Space;
  lens: LayerName;
}): LensDrawingEntry[] {
  const entries: LensDrawingEntry[] = [];
  for (const path of displayCandidatePaths({ space, lens })) {
    const closure = space.closure({ layer: lens, path });
    const types: Address[] = [];
    for (const source of closure) {
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
    for (const [sourceLayer, sourcePath] of closure) {
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (!isDictionary(node) || !("display" in node)) continue;
      const display = node["display"];
      if (display === null) continue;
      const spec = asGlyphList(display);
      if (spec.length === 0) continue;
      const guard = asDisplayGuard(node["__when:display"] ?? null);
      entries.push({ path, spec, types, guard });
    }
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

// Read one key path on a node: the last segment reads at the node,
// the earlier ones descend through address views. A missing segment
// or a non-address intermediate = the path is absent (found: false).
function readGuardPath({
  space,
  layer,
  path,
  segments,
}: {
  space: Space;
  layer: LayerName;
  path: LayerPath;
  segments: string[];
}): { found: boolean; value: unknown } {
  let currentLayer = layer;
  let currentPath = path;
  for (const [index, segment] of segments.entries()) {
    const value = space.read({ layer: currentLayer, path: currentPath, key: segment });
    if (index === segments.length - 1) return { found: value !== null, value };
    if (!(value instanceof AddressView)) return { found: false, value: null };
    currentLayer = value.layer;
    currentPath = value.path;
  }
  return { found: false, value: null };
}

/** Does the guard hold on the dressed node? Strate 1: presence of
 * the key path, or membership in the closed set. A guard citing an
 * absent key does not hold — the entry is not retained, never a
 * crash (the kernel stays total). */
export function guardHolds({
  space,
  layer,
  path,
  guard,
}: {
  space: Space;
  layer: LayerName;
  path: LayerPath;
  guard: DisplayGuard;
}): boolean {
  const read = readGuardPath({ space, layer, path, segments: guard.path });
  if (!read.found) return false;
  if (guard.kind === "presence") return true;
  return guard.values.some((expected) => expected === read.value);
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
}): { path: LayerPath; spec: Glyph[]; hit: Address[]; guard: DisplayGuard | null }[] {
  const chain = space.closure({ layer, path });
  const matches: {
    path: LayerPath;
    spec: Glyph[];
    hit: Address[];
    guard: DisplayGuard | null;
  }[] = [];
  for (const entry of lensDrawingEntries({ space, lens })) {
    const hit = entry.types.filter((type) => chain.some((member) => addressesEqual(member, type)));
    if (hit.length) matches.push({ path: entry.path, spec: entry.spec, hit, guard: entry.guard });
  }
  return matches;
}

// Drawn read: the FIRST WINNING GUARD takes the node (the entries are
// in the harness order — a lens child's entries before its parent's,
// ADR-0100); a guard that does not hold retains nothing. When no
// guard holds, the fallback is the most specific of the unguarded
// entries — measured by closure, independently of the chain order
// (think1 carries its most specific type at the end of the chain,
// producer at the beginning).
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
  const matches = dressingEntries({ space, lens, layer, path });
  for (const match of matches) {
    if (match.guard !== null && guardHolds({ space, layer, path, guard: match.guard })) {
      return { spec: match.spec, hit: match.hit };
    }
  }
  let best: { path: LayerPath; spec: Glyph[]; hit: Address[] } | null = null;
  for (const match of matches) {
    if (match.guard !== null) continue;
    if (best === null) {
      best = match;
      continue;
    }
    // Strictly more specific wins; on a tie the first (the child's)
    // stays — the order is the semantics (ADR-0100).
    if (
      coversAddresses({ space, covering: match.hit, covered: best.hit }) &&
      !coversAddresses({ space, covering: best.hit, covered: match.hit })
    ) {
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
