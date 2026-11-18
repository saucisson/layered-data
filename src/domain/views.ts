// The views module: the space's observable views (closures, keys,
// reads, lens entries, drawn reads, applicability). Everything here
// is a PURE OBSERVATION of the space: nothing is written, no verdict
// changes.
//
// Three consumers read through this module:
//   - the drawing panels (the lens shapes of the glyphs);
//   - the validator and the checks (walkAddresses).

import { type LayerName, type LayerPath, asPathSegment } from "./identifiers.ts";
import {
  type Address,
  type RawTree,
  type RawValue,
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

/** Where the label sits relative to the glyph's bounds — `inside`
 * is the vertices' default (the historical behaviour), the sides are
 * the edges' idiom (outside, on the named side of the bounds). */
export type LabelSide = "inside" | "north" | "south" | "east" | "west";

export const LABEL_SIDES: readonly LabelSide[] = ["inside", "north", "south", "east", "west"];

/** The fields every vertex glyph may carry (issue #284): dimensions
 * (defaults = the historical sizes), a dashed stroke, an offset, a
 * rotation around the node's centre, and a declared label placement. */
export interface GlyphCommon {
  fill?: string;
  stroke?: string;
  label?: string;
  dash?: boolean;
  dx?: number;
  dy?: number;
  angle?: number;
  "label-side"?: LabelSide;
  "label-dx"?: number;
  "label-dy"?: number;
}

/** One glyph of the closed drawing vocabulary, discriminated by
 * `shape` — the corpus's display templates carry exactly these
 * fields (see formalisms/kernel/*-display.ld). Vertex glyphs are
 * circle/ellipse/rectangle/box/path; the edge glyph is line. */
export type Glyph =
  | (GlyphCommon & { shape: "circle"; r?: number })
  | (GlyphCommon & { shape: "ellipse"; rx?: number; ry?: number })
  | (GlyphCommon & { shape: "rectangle"; w?: number; h?: number })
  | (GlyphCommon & { shape: "box"; w?: number; h?: number })
  | (GlyphCommon & { shape: "path"; d: string })
  | {
      shape: "line";
      arrow?: string;
      ports?: number;
      stroke?: string;
      dash?: boolean;
      curve?: "polyline" | "bezier";
    };

export const GLYPH_SHAPES: readonly string[] = [
  "circle",
  "ellipse",
  "rectangle",
  "box",
  "path",
  "line",
];

/** Strict grammar of a `path` glyph's `d` (issue #284): the commands
 * M L H V C S Q T A Z (either case), numbers, and separators (space,
 * comma) — nothing else, ever (no text, no references). */
export function isValidPathData(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  const residue = value
    .replace(/[MLHVCSQTAZmlhvcsqtaz]/g, " ")
    .replace(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g, " ")
    .replace(/[\s,]+/g, " ");
  return residue.trim() === "";
}

/** The staging verdict a raw glyph carries, if any (issue #287): an
 * unknown shape, or a `path` whose `d` is outside the grammar. */
export function glyphShapeVerdict(value: unknown): "forme-inconnue" | "tracé-invalide" | null {
  if (!isDictionary(value)) return "forme-inconnue";
  const shape = value["shape"];
  if (typeof shape !== "string" || !GLYPH_SHAPES.includes(shape)) return "forme-inconnue";
  if (shape === "path" && !isValidPathData(value["d"])) return "tracé-invalide";
  return null;
}

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Narrow a raw display template to a glyph — unknown shapes and
 * non-dictionary values are not glyphs (the entry is then skipped,
 * never a crash; the staging verdict names the fault). */
export function asGlyph(value: unknown): Glyph | null {
  if (!isDictionary(value)) return null;
  const shape = value["shape"];
  const common: GlyphCommon = {};
  if (typeof value["fill"] === "string") common.fill = value["fill"];
  if (typeof value["stroke"] === "string") common.stroke = value["stroke"];
  if (typeof value["label"] === "string") common.label = value["label"];
  if (typeof value["dash"] === "boolean") common.dash = value["dash"];
  const dx = asNumber(value["dx"]);
  if (dx !== undefined) common.dx = dx;
  const dy = asNumber(value["dy"]);
  if (dy !== undefined) common.dy = dy;
  const angle = asNumber(value["angle"]);
  if (angle !== undefined) common.angle = angle;
  const labelSide = value["label-side"];
  if (typeof labelSide === "string" && (LABEL_SIDES as readonly string[]).includes(labelSide)) {
    common["label-side"] = labelSide as LabelSide;
  }
  const labelDx = asNumber(value["label-dx"]);
  if (labelDx !== undefined) common["label-dx"] = labelDx;
  const labelDy = asNumber(value["label-dy"]);
  if (labelDy !== undefined) common["label-dy"] = labelDy;
  if (shape === "circle") {
    const glyph: Extract<Glyph, { shape: "circle" }> = { ...common, shape };
    const r = asNumber(value["r"]);
    if (r !== undefined) glyph.r = r;
    return glyph;
  }
  if (shape === "ellipse") {
    const glyph: Extract<Glyph, { shape: "ellipse" }> = { ...common, shape };
    const rx = asNumber(value["rx"]);
    if (rx !== undefined) glyph.rx = rx;
    const ry = asNumber(value["ry"]);
    if (ry !== undefined) glyph.ry = ry;
    return glyph;
  }
  if (shape === "rectangle" || shape === "box") {
    const glyph: Extract<Glyph, { shape: "rectangle" | "box" }> = { ...common, shape };
    const w = asNumber(value["w"]);
    if (w !== undefined) glyph.w = w;
    const h = asNumber(value["h"]);
    if (h !== undefined) glyph.h = h;
    return glyph;
  }
  if (shape === "path") {
    if (typeof value["d"] !== "string") return null;
    return { ...common, shape, d: value["d"] };
  }
  if (shape === "line") {
    const glyph: Extract<Glyph, { shape: "line" }> = { shape: "line" };
    if (typeof value["arrow"] === "string") glyph.arrow = value["arrow"];
    if (typeof value["ports"] === "number") glyph.ports = value["ports"];
    if (typeof value["stroke"] === "string") glyph.stroke = value["stroke"];
    if (typeof value["dash"] === "boolean") glyph.dash = value["dash"];
    if (value["curve"] === "polyline" || value["curve"] === "bezier") glyph.curve = value["curve"];
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

/** A display guard, narrowed from its raw form — presence of a key
 * path on the dressed node, membership in a closed set (strate 1),
 * or a comparison (strate 2). */
export type DisplayGuard =
  | { kind: "presence"; path: string[] }
  | { kind: "member"; path: string[]; values: unknown[] }
  | {
      kind: "compare";
      path: string[];
      op: ">" | "<" | ">=" | "<=" | "=" | "!=";
      value: unknown;
    };

const COMPARE_OPS = [">", "<", ">=", "<=", "=", "!="] as const;

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
  if (kind === "compare") {
    const op = value["op"];
    if (typeof op !== "string" || !(COMPARE_OPS as readonly string[]).includes(op)) return null;
    const compareOp = op as ">" | "<" | ">=" | "<=" | "=" | "!=";
    return { kind: "compare", path: guardPath, op: compareOp, value: value["value"] ?? null };
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
 * matched on the node's chain. `guarded` tells whether the winner
 * came from a guarded entry (a data condition) or the unguarded
 * fallback. */
export interface DrawnShape {
  spec: Glyph[];
  hit: Address[];
  guarded: boolean;
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
  // A multi-glyph `glyphs` block is read whole at its nearest defining
  // source (block-level override). A single-glyph template is merged
  // FIELD BY FIELD along the closure (oldest first, the child wins):
  // a partial override (`override fill = …` alone) inherits the
  // parent's shape instead of producing an empty glyph (issue #287).
  let merged: Record<string, unknown> | null = null;
  for (const [sourceLayer, sourcePath] of space.closure({ layer: lens, path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (!isDictionary(node) || !("display" in node)) continue;
    const display = node["display"];
    if (display === null) continue;
    if (isDictionary(display) && isDictionary(display["glyphs"])) {
      return asGlyphList(display);
    }
    if (isDictionary(display)) {
      merged = { ...(merged ?? {}), ...display };
    } else if (Array.isArray(display)) {
      return asGlyphList(display);
    }
  }
  return merged === null ? null : asGlyphList(merged);
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

/** Does the guard hold on the dressed node? Presence of the key
 * path, membership in the closed set (strate 1), or a comparison
 * (strate 2 — ordering operators need numbers, = / != work on any
 * value). A guard citing an absent key does not hold — the entry is
 * not retained, never a crash (the kernel stays total). */
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
  if (guard.kind === "member") return guard.values.some((expected) => expected === read.value);
  const left = read.value;
  const right = guard.value;
  switch (guard.op) {
    case "=":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
    case "<":
    case ">=":
    case "<=":
      if (typeof left !== "number" || typeof right !== "number") return false;
      if (guard.op === ">") return left > right;
      if (guard.op === "<") return left < right;
      if (guard.op === ">=") return left >= right;
      return left <= right;
    default:
      return false;
  }
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
      return { spec: match.spec, hit: match.hit, guarded: true };
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
  return best === null ? null : { spec: best.spec, hit: best.hit, guarded: false };
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
// the model does the lens dress, and how many of those are dressed by
// a guarded entry (a data condition) rather than the default.
export function dressingApplicability({
  space,
  lens,
  model,
}: {
  space: Space;
  lens: LayerName;
  model: LayerName;
}): { dressed: number; total: number; guarded: number } {
  const vertices = space.read({ layer: model, path: [], key: "vertices" });
  if (!(vertices instanceof AddressView)) return { dressed: -1, total: -1, guarded: -1 };
  const vertexKeys = space.keys({ layer: model, path: vertices.path });
  let dressed = 0;
  let guarded = 0;
  for (const vertexKey of vertexKeys) {
    const shape = drawnShape({
      space,
      lens,
      layer: model,
      path: [...vertices.path, asPathSegment(vertexKey)],
    });
    if (shape !== null) {
      dressed++;
      if (shape.guarded) guarded++;
    }
  }
  return { dressed, total: vertexKeys.length, guarded };
}

// ---- serialization helpers -------------------------------------------
// Comparable serialization (same conventions as the harness:
// __ref, __lref, __addr) — driver-independent, so the kernel
// stays testable without one.

/** A value rendered as plain JSON-compatible data: references become
 * `__ref` / `__lref` / `__addr` markers, dictionaries and lists recurse. */
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export function serializableValue(value: RawValue): SerializableValue {
  if (value instanceof PathReference) return { __ref: [value.anchor, ...value.path] };
  if (value instanceof LayerReference) return { __lref: value.layer };
  if (Array.isArray(value)) return value.map(serializableValue);
  if (isDictionary(value)) {
    const serialized: Record<string, SerializableValue> = {};
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (entry !== undefined) serialized[key] = serializableValue(entry);
    }
    return serialized;
  }
  return value;
}

export function normalizedValue(value: RawValue | AddressView): SerializableValue {
  if (value instanceof AddressView) return { __addr: [value.layer, value.path] };
  return serializableValue(value);
}

// Deep clone of a layers value (references recreated: two spaces
// share nothing).
export function deepCloneValue(value: RawValue): RawValue {
  if (value instanceof PathReference) return new PathReference(value.anchor, [...value.path]);
  if (value instanceof LayerReference) return new LayerReference(value.layer);
  if (Array.isArray(value)) return value.map(deepCloneValue);
  if (isDictionary(value)) {
    const clone: RawTree = {};
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (entry !== undefined) clone[key] = deepCloneValue(entry);
    }
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


