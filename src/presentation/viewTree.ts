// The viewpoint inventory and the drawing helpers of panel ④: the
// lenses dress the types of a scheme, the viewpoints designate a
// model and a lens by LRef fields; the tree on the left follows the
// refinements internal to the group, the drawing on the right
// follows the choice — no more frozen cards, a living viewpoint.

import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { isDictionary, LayerReference, PathReference, type RawTree } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import type { Glyph } from "../domain/views.ts";
import type { Language } from "../domain/messages.ts";
import { resolvePositionAt } from "../application/positions.ts";
import { say } from "./i18n.ts";
import type { BilingualText } from "./i18n.ts";

// ---- the inventory of looks, derived from the space (issue #283) ----
// No hardcoded list: a lens is a layer whose refines closure contains
// a display scheme, a viewpoint one whose closure contains
// @view-scheme — a lens staged by the user appears without touching
// the code. The order is the assembly order (stable).

/** The transitive `refines` closure of a layer, itself included. */
export function refinesClosure({ space, layer }: { space: Space; layer: string }): string[] {
  const seen = new Set<string>();
  const queue = [layer];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    let refinements: unknown;
    try {
      refinements = space.read({
        layer: asLayerName(current),
        path: asLayerPath([]),
        key: "refines",
      });
    } catch {
      continue;
    }
    if (!Array.isArray(refinements)) continue;
    for (const entry of refinements) {
      if (entry instanceof LayerReference) queue.push(entry.layer);
      else if (entry instanceof PathReference && entry.path.length === 0) queue.push(entry.anchor);
    }
  }
  return [...seen];
}

/** Does the layer's OWN source pose at least one `display` TEMPLATE
 * (on the root or on a type below it)? A viewpoint's `display = @…`
 * slot is an address, not a template — it does not make the layer a
 * display scheme. */
export function posesDisplay({ space, layer }: { space: Space; layer: string }): boolean {
  const root = space.raw({ layer: asLayerName(layer), path: asLayerPath([]) });
  if (!isDictionary(root)) return false;
  const stack: RawTree[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as RawTree;
    const display = node["display"];
    if (
      display !== undefined &&
      display !== null &&
      !(display instanceof LayerReference) &&
      !(display instanceof PathReference)
    ) {
      return true;
    }
    for (const value of Object.values(node)) {
      if (isDictionary(value)) stack.push(value);
    }
  }
  return false;
}

/** The display schemes: layers posing a `display` block whose
 * ancestors pose none — the roots of the lens families. */
export function displaySchemeLayers({ space }: { space: Space }): string[] {
  const names = Object.keys(space.layers);
  const posing = new Set(names.filter((name) => posesDisplay({ space, layer: name })));
  return names.filter(
    (name) =>
      posing.has(name) &&
      refinesClosure({ space, layer: name }).every(
        (ancestor) => ancestor === name || !posing.has(ancestor),
      ),
  );
}

/** The lens layers of the workshop: every layer whose refines closure
 * contains a display scheme (the schemes included). */
export function lensLayers({ space }: { space: Space }): string[] {
  const schemes = new Set(displaySchemeLayers({ space }));
  return Object.keys(space.layers).filter((name) =>
    refinesClosure({ space, layer: name }).some((ancestor) => schemes.has(ancestor)),
  );
}

/** Is this layer a lens (its closure contains a display scheme)? */
export function isLensLayer({ space, layer }: { space: Space; layer: string }): boolean {
  const schemes = new Set(displaySchemeLayers({ space }));
  return refinesClosure({ space, layer }).some((ancestor) => schemes.has(ancestor));
}

/** The viewpoint layers of the workshop: every layer whose refines
 * closure contains @view-scheme. */
export function viewpointLayers({ space }: { space: Space }): string[] {
  return Object.keys(space.layers).filter((name) =>
    refinesClosure({ space, layer: name }).includes("view-scheme"),
  );
}

/** The note of a look: its layer's head comment, read as data (the
 * compiler carries it under the `note` key) — one line, English. */
export function viewNote({ space, layer }: { space: Space; layer: string }): BilingualText {
  const root = space.raw({ layer: asLayerName(layer), path: asLayerPath([]) });
  const note = isDictionary(root) ? root["note"] : null;
  const text = Array.isArray(note)
    ? note
        .join("")
        .split("\n")
        .map((line) => line.trim().replace(/^\/\/+\s?/, ""))
        .filter((line) => line.length > 0)
        .join(" ")
    : "";
  return { en: text };
}

// ---- the group tree ----

/** The parent of a formalism WITHIN its group: the first
 * refinement present in the group — the courses refine their view,
 * the lenses their schemes; only the links internal to a group make
 * the tree (petrinet-display ↳ graph-display,
 * pn-philosophers-5-course ↳ petrinet-view). */
export function parentWithinGroup({
  space,
  layer,
  members,
}: {
  space: Space;
  layer: string;
  members: string[];
}): string | null {
  try {
    const refinements: any = space.read({
      layer: asLayerName(layer),
      path: asLayerPath([]),
      key: "refines",
    });
    if (!Array.isArray(refinements)) return null;
    for (const entry of refinements) {
      if (entry instanceof LayerReference && members.includes(entry.layer)) return entry.layer;
      if (
        entry instanceof PathReference &&
        entry.path.length === 0 &&
        members.includes(entry.anchor)
      ) {
        return entry.anchor;
      }
    }
  } catch {
    // the look stays readable whatever the space answers
  }
  return null;
}

/** The tree of one group: roots first, then descendants — stable
 * order of the inventory, depth by refinement. */
export function groupTree({ space, members }: { space: Space; members: string[] }): {
  layer: string;
  depth: number;
}[] {
  const out: { layer: string; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const layer of members) {
      if (parentWithinGroup({ space, layer, members }) === parent) {
        out.push({ layer, depth });
        visit(layer, depth + 1);
      }
    }
  };
  visit(null, 0);
  return out;
}

// ---- positions ----

/** Circle layout: when the viewpoint decides no positions, the
 * drawing stays readable — every vertex on a circle of the frame
 * (270×220), one lone vertex at the center. */
export function circlePosition({
  index,
  total,
}: {
  index: number;
  total: number;
}): { x: number; y: number } | null {
  if (total <= 0) return null;
  if (total === 1) return { x: 135, y: 110 };
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / total;
  return { x: 135 + 85 * Math.cos(angle), y: 110 + 85 * Math.sin(angle) };
}

/** The RESOLVED position of a named object.
 * The data stays raw — system, axes, relative_to — and the
 * resolution lives in the reader: the grid is read as is (1D: null
 * y; 3D: z read, not drawn), the pole is converted (theta in
 * degrees, zero east, clockwise on the drawing), a relative cites an
 * upstream position and carries an offset — the chain resolves up
 * to the first absolute point; a cycle returns null: nothing is
 * drawn, nothing spins. */
export function resolvedPosition({
  space,
  layer,
  path,
  visited,
}: {
  space: Space;
  layer: string;
  path: string[];
  visited: Set<string>;
}): { x: number; y: number } | null {
  // one resolution for the workshop and the editor — the shared core
  // lives in the application layer
  return resolvePositionAt({ space, layer, path, visited });
}

/** The resolved position of a named object within one source
 * layer's `positions` collection. */
export function positionOf({
  space,
  source,
  name,
}: {
  space: Space;
  source: string;
  name: string;
}): {
  x: number;
  y: number;
} | null {
  return resolvedPosition({ space, layer: source, path: ["positions", name], visited: new Set() });
}

/** The bound value of one key of a viewpoint, with the layer that
 * provides it (the winner) — for the "who decides what" readouts. */
export function bindingOf({ space, view, key }: { space: Space; view: string; key: string }): {
  value: any;
  winner: [string, string[]] | null;
} {
  const scan: any[] = [];
  const value = space.read({ layer: asLayerName(view), path: asLayerPath([]), key, scan });
  const last = scan.length ? scan[scan.length - 1] : null;
  return { value, winner: last && last.status === "fournit" ? last.source : null };
}

/** One glyph as text, in the workshop language. */
function glyphLabel({ glyph, language }: { glyph: Glyph; language: Language }): string {
  if (glyph.shape === "circle") return say({ language, en: "circle"});
  if (glyph.shape === "ellipse") return say({ language, en: "ellipse"});
  if (glyph.shape === "rectangle") return say({ language, en: "rectangle"});
  if (glyph.shape === "box") {
    return say({
      language,
      en: "box (" + (glyph.label ?? "") + ")",
    });
  }
  if (glyph.shape === "line") {
    return glyph.ports === 2
      ? say({ language, en: "2-port arc"})
      : say({ language, en: "line"});
  }
  return say({ language, en: "unknown shape"});
}

/** The drawing shape as text (for the "shapes" readouts), in the
 * workshop language — a multi-glyph template reads as its overlaid
 * glyphs joined by "+". */
export function shapeLabel({
  shape,
  language,
}: {
  shape: Glyph[] | null;
  language: Language;
}): string {
  if (!shape || shape.length === 0) return say({ language, en: "no shape"});
  return shape.map((glyph) => glyphLabel({ glyph, language })).join(" + ");
}
