// The viewpoint inventory and the drawing helpers of panel ④: the
// lenses dress the types of a scheme, the viewpoints designate a
// model and a lens by LRef fields; the tree on the left follows the
// refinements internal to the group, the drawing on the right
// follows the choice — no more frozen cards, a living viewpoint.

import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { LayerReference, PathReference } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import type { Language } from "../domain/messages.ts";
import { resolvePositionAt } from "../application/positions.ts";
import { say } from "./i18n.ts";
import type { BilingualText } from "./i18n.ts";

// ---- the inventory of looks (UI data of the corpus) ----

/** The lens layers of the workshop. */
export const LENS_LAYERS = ["graph-display", "petrinet-display", "kahn-display"];

/** The viewpoint layers of the workshop. */
export const VIEWPOINT_LAYERS = [
  "petrinet-view",
  "pn-philosophers-5-course",
  "kahn-course",
  "wb-course",
];

/** The description of each look — bilingual UI data. */
export const VIEW_NOTES: Record<string, BilingualText> = {
  "graph-display": {
    en: "The generic lens: a circle per vertex, a line per arc — it dresses every graph descendant, no place/transition distinction.",
    fr: "La lentille générique : un cercle par sommet, un trait par arc — elle habille tout descendant du graphe, aucune distinction place/transition.",
  },
  "petrinet-display": {
    en: "The Petri lens: ellipses for the places, rectangles for the transitions, 2-port arcs — the generic circle stays for the unknown types.",
    fr: "La lentille Petri : ellipses pour les places, rectangles pour les transitions, arcs à 2 ports — le cercle générique reste pour les types inconnus.",
  },
  "kahn-display": {
    en: "The Kahn lens: boxes for processes and channels — on the dinner, it knows no Petri types: everything falls back to the generic circle, without an error (a lens displays only what it knows).",
    fr: "La lentille Kahn : boîtes pour processus et canaux — sur le dîner, elle ne connaît pas les types Petri : tout retombe au cercle générique, sans erreur (la lentille n'affiche que ce qu'elle sait).",
  },
  "petrinet-view": {
    en: "The abstract Petri viewpoint: the lens is decided (petrinet-display), the model stays a slot — the current model of ① applies.",
    fr: "Le point de vue Petri abstrait : la lentille est tranchée (petrinet-display), le modèle reste un slot — le modèle courant de ① s'applique.",
  },
  "pn-philosophers-5-course": {
    en: "The dinner through the Petri lens, course positions: 15 ellipses, 10 rectangles, 2-port arcs.",
    fr: "Le dîner par la lentille Petri, positions du cours : 15 ellipses, 10 rectangles, arcs à 2 ports.",
  },
  "kahn-course": {
    en: "The same dinner through the Kahn lens — a legal degradation: everything falls back to the generic circle. No position decided: circle layout.",
    fr: "Le même dîner par la lentille Kahn — dégradation légale : tout retombe au cercle générique. Aucune position décidée : disposition cercle.",
  },
  "wb-course": {
    en: "The weighted diamond — wb1 through the generic lens: 3 circles, 2 lines. The weights are data read through the diamond — e1 carries 3 (first-wins), e2 inherits 1 from the weighted-hypergraph default. Two axes, one model, no copy.",
    fr: "Le diamant pondéré — wb1 par la lentille générique : 3 cercles, 2 traits. Les poids sont des données lues à travers le diamant — e1 porte 3 (premier-gagné), e2 hérite 1 du défaut de weighted-hypergraph. Deux axes, un modèle, aucune copie.",
  },
};

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

/** One drawing shape as text (for the "shapes" readouts), in the
 * workshop language. */
export function shapeLabel({ shape, language }: { shape: any; language: Language }): string {
  if (!shape) return say({ language, en: "no shape", fr: "sans forme" });
  if (shape.shape === "circle") return say({ language, en: "circle", fr: "cercle" });
  if (shape.shape === "ellipse") return say({ language, en: "ellipse", fr: "ellipse" });
  if (shape.shape === "rectangle") return say({ language, en: "rectangle", fr: "rectangle" });
  if (shape.shape === "box") {
    return say({ language, en: "box (" + shape.label + ")", fr: "boîte (" + shape.label + ")" });
  }
  if (shape.shape === "line") {
    return shape.ports === 2
      ? say({ language, en: "2-port arc", fr: "arc à 2 ports" })
      : say({ language, en: "line", fr: "trait" });
  }
  return shape.shape;
}
