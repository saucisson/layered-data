// The workshop inventory: the principal parent axis of panel ①
// (one parent per layer), the role and color badges of the corpus
// layers (bilingual UI data), and the refinement
// DAG read in the kernel space (the LRef of the `refines` keys),
// never copied blindly: a layer with multiple inheritance appears
// once there, with its two arrows.
//
// The layout is deterministic: node width measured on its name,
// pixel barycenter, centered bands — recomputed when the living
// inventory changes (the corpus ranks stay frozen, added layers
// enter their bands; the barycenter recounts over the whole
// inventory — pastilles may slide horizontally, never change
// bands).

import { LayerReference } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import type { BilingualText } from "./i18n.ts";

// ---- the static axis and the badges (UI data of the corpus) ----

/** The principal parent of each corpus layer — panel ① in "list"
 * view gives one parent per layer; the real space is a DAG, the
 * graph view shows it all. */
export const PRINCIPAL_PARENT: Record<string, string | null> = {
  record: null,
  collection: null,
  "positions-scheme": "record",
  "positions-grid": "positions-scheme",
  "positions-polar": "positions-scheme",
  multihypergraph: "record",
  hypergraph: "multihypergraph",
  "uniform-hypergraph": "multihypergraph",
  "named-ends-hypergraph": "multihypergraph",
  "pair-graph": "multihypergraph",
  graph: "pair-graph",
  "graph-with-positions": "graph",
  multidigraph: "named-ends-hypergraph",
  digraph: "multidigraph",
  "oriented-graph": "digraph",
  dag: "multidigraph",
  tree: "dag",
  "sperner-hypergraph": "hypergraph",
  "k-partite-hypergraph": "multihypergraph",
  "mixed-graph": "named-ends-hypergraph",
  "bipartite-digraph": "multidigraph",
  "vertex-annotated-hypergraph": "multihypergraph",
  "edge-annotated-hypergraph": "multihypergraph",
  "weighted-hypergraph": "edge-annotated-hypergraph",
  "weighted-bipartite": "bipartite-digraph",
  "petrinet-scheme": "bipartite-digraph",
  "pn-philosophers": "petrinet-scheme",
  "pn-philosophers-1": "pn-philosophers",
  "pn-philosophers-5": "pn-philosophers",
  "pn-philosophers-5-bounds": "pn-philosophers-5",
  "pn-philosophers-5-bounds-c1": "pn-philosophers-5-bounds",
  wb1: "weighted-bipartite",
  "automaton-scheme": "graph",
  "petrinet-behavior": "record",
  "petrinet-statespace": "automaton-scheme",
  "ss-pn-philosophers-5": "petrinet-statespace",
  "ss-pn-philosophers-5-inst": "ss-pn-philosophers-5",
  "kahn-scheme": "bipartite-digraph",
  "graph-display": "multidigraph",
  "petrinet-display": "graph-display",
  "kahn-display": "graph-display",
  "view-scheme": "record",
  "petrinet-view": "view-scheme",
  "pn-philosophers-5-course": "petrinet-view",
  "kahn-course": "view-scheme",
  "wb-course": "view-scheme",
};

/** The role sentence of each corpus layer, shown as its inventory
 * description — bilingual UI data, English the default. */
export const LAYER_ROLE: Record<string, BilingualText> = {
  record: {
    en: "the ground: a record node",
    fr: "le fondamental : un nœud record",
  },
  collection: {
    en: "the ground: a typed collection",
    fr: "le fondamental : une collection typée",
  },
  "positions-scheme": {
    en: "the positions base — named objects, coordinate system, abstract axes; dimension is data (1D, 2D, 3D), the position absolute or relative to an upstream position",
    fr: "la base des positions — objets nommés, système de coordonnées, axes abstraits ; la dimension est une donnée (1D, 2D, 3D), la position absolue ou relative à une position amont",
  },
  "positions-grid": {
    en: "the grid: the default system, cartesian axes x, y, z — dimension lands as data",
    fr: "la grille : le système par défaut, axes cartésiens x, y, z — la dimension se pose par données",
  },
  "positions-polar": {
    en: "the pole: distance r, angle theta in degrees (zero at east, drawing-wise clockwise), z lifts the plane into a cylinder",
    fr: "le pôle : distance r, angle theta en degrés (zéro à l'est, sens horaire du dessin), z monte le plan en cylindre",
  },
  multihypergraph: {
    en: "the base: typed vertices and edges, incidence by arrows — any arity; multiplicity, intra-repetition and empty edges are the unmarked normality of the mechanism (keyed edges)",
    fr: "la base : sommets et arêtes typés, incidence par flèches — arité quelconque ; multiplicité, répétition intra et arêtes vides sont la normalité non marquée du mécanisme (arêtes à clés)",
  },
  hypergraph: {
    en: "the named restriction: the pure multihypergraph — non-empty parts, unique edges, no intra-repetition (checks simple + nonempty, layer level: the constraint travels by composition)",
    fr: "la restriction nommée : le multihypergraphe pur — parties non vides, arêtes uniques, pas de répétition intra (checks simple + nonempty, niveau couche : la contrainte voyage par composition)",
  },
  "uniform-hypergraph": {
    en: "the generalized arity axis: the bounds of the arrow collection become an unbound slot — the k-uniform refinement binds both to k",
    fr: "axe arité généralisé : les bornes de la collection des flèches deviennent un slot non lié — le raffinement k-uniforme lie les deux à k",
  },
  "named-ends-hypergraph": {
    en: "the named-ends base: free-cardinality arrows, able to designate a field of the edge (self-designation)",
    fr: "base des extrémités nommées : flèches à cardinalité libre, pouvant désigner un champ de l'arête (auto-désignation)",
  },
  "pair-graph": {
    en: "the bounded arity axis: exactly 2 arrows, no roles — an undirected graph",
    fr: "axe arité borné : exactement 2 flèches, sans rôles — un graphe non orienté",
  },
  graph: {
    en: "the mathematician's simple graph: 2-uniform and pure — « a 2-uniform hypergraph is a graph » (a recycled name, orientation lives in multidigraph)",
    fr: "le graphe simple du mathématicien : 2-uniforme et pur — « a 2-uniform hypergraph is a graph » (nom recyclé, l'orientation vit dans multidigraph)",
  },
  "graph-with-positions": {
    en: "a « positions » derivation: a graph whose vertices get placed — the composition of the graph and the grid",
    fr: "dérivation « positions » : un graphe dont les sommets se posent — la composition du graphe et de la grille",
  },
  multidigraph: {
    en: "orientation: 2 arrows source / target, a renaming of the connection points; the base leaves parallel arcs and loops permitted there (ex graph)",
    fr: "l'orientation : 2 flèches source / target, un renommage des points de connexion ; la base y laisse arcs parallèles et boucles permis (ex graph)",
  },
  digraph: {
    en: "pure arcs: orientation x purity — neither parallel arcs nor arc-loops, legal 2-cycles (the « simple digraph »)",
    fr: "arcs purs : orientation × pureté — ni arcs parallèles ni boucles-arcs, 2-cycles légaux (le « simple digraph »)",
  },
  "oriented-graph": {
    en: "the strict sense: no pair of opposite arcs (check oriented, per arc address)",
    fr: "le sens strict : aucun couple d'arcs opposés (check oriented, par adresse d'arc)",
  },
  dag: {
    en: "the acyclicity axis (check dag, per arc address)",
    fr: "axe acyclicité (check dag, par adresse d'arc)",
  },
  tree: {
    en: "the connectivity axis: [dag, digraph] + a tree check at the layer level",
    fr: "axe connexité : [dag, digraph] + check arbre au niveau couche",
  },
  "sperner-hypergraph": {
    en: "the antichain / clutter: no edge contains another (check sperner)",
    fr: "l'antichaîne / clutter : aucune arête n'en contient une autre (check sperner)",
  },
  "k-partite-hypergraph": {
    en: "the generalized partition axis: k named classes (the concrete sources of the vertices alias), each edge touches at most one vertex per class — the bipartite is its k = 2 specialization",
    fr: "axe partition généralisé : k classes nommées (les sources concrètes de l'alias vertices), chaque arête touche au plus un sommet par classe — le biparti en est la spécialisation k = 2",
  },
  "mixed-graph": {
    en: "(V, E, A): undirected pair edges and oriented arcs — arc_type = the pair edge + the source/target roles",
    fr: "(V, E, A) : arêtes de paire non orientées et arcs orientés — arc_type = l'arête de paire + les rôles source/target",
  },
  "bipartite-digraph": {
    en: "the k = 2 partition crossed with orientation: left / right, crossing arcs A to B and B to A — refines multidigraph and k-partite-hypergraph",
    fr: "la partition k = 2 croisée avec l'orientation : left / right, arcs croisés A→B et B→A — raffine multidigraph et k-partite-hypergraph",
  },
  "weighted-hypergraph": {
    en: "the attribute axis: the bound case of edge annotation — slot weight, default 1 (hoisted from graph: weight does not orient)",
    fr: "axe attributs : le cas lié de l'annotation d'arêtes — slot weight, défaut 1 (remonté de graph : le poids n'oriente pas)",
  },
  "weighted-bipartite": {
    en: "the diamond: refines bipartite-digraph and weighted-hypergraph — multiple inheritance of layers",
    fr: "le diamant : raffine bipartite-digraph et weighted-hypergraph — héritage multiple de couches",
  },
  "vertex-annotated-hypergraph": {
    en: "the annotation axis (vertices), hoisted under the base: annotating does not orient (ex node-annotated-graph)",
    fr: "axe annotation (sommets), hoisté sous la base : annoter n'oriente pas (ex node-annotated-graph)",
  },
  "edge-annotated-hypergraph": {
    en: "the annotation axis (edges), hoisted: the annotated edge is no longer oriented (ex arc-annotated-graph) — ps becomes the triple inheritance",
    fr: "axe annotation (arêtes), hoisté : l'arête annotée n'est plus orientée (ex arc-annotated-graph) — ps devient l'héritage triple",
  },
  "petrinet-scheme": {
    en: "the Petri scheme: refines bipartite-digraph — names do not refine (places are not left), paths do; weight on the arcs",
    fr: "schéma Petri : raffine bipartite-digraph — les noms ne se raffinent pas (places ≠ left), les chemins si ; poids sur les arcs",
  },
  "pn-philosophers": {
    en: "the philosophers scheme: concrete types, default weight = 1",
    fr: "schéma philosophes : types concrets, défaut weight = 1",
  },
  "pn-philosophers-1": {
    en: "the template: one philosopher alone — 3 places, 2 transitions, 2 pre arcs + 1 post arc, cited 5 times by the dinner",
    fr: "le template : un philosophe seul — 3 places, 2 transitions, 2 arcs pré + 1 arc post, cité 5 fois par le dîner",
  },
  "pn-philosophers-5": {
    en: "the dinner: five citations of the template in a ring — 15 places, 10 transitions, 25 arcs, weight 1",
    fr: "le dîner : cinq citations du template en anneau — 15 places, 10 transitions, 25 arcs, weight 1",
  },
  "pn-philosophers-5-bounds": {
    en: "annotation: a bound field on place_type, laid on the dinner",
    fr: "annotation : champ bound sur place_type, posé sur le dîner",
  },
  "pn-philosophers-5-bounds-c1": {
    en: "constraint: bound = 1 on places/philo1.think1 (partial shadow)",
    fr: "contrainte : bound = 1 sur places/philo1.think1 (ombre partielle)",
  },
  wb1: {
    en: "the diamond model: 2 left, 1 right, 2 weighted arcs — e1 carries 3, e2 inherits 1",
    fr: "modèle du diamant : 2 left, 1 right, 2 arcs pondérés — e1 porte 3, e2 hérite 1",
  },
  "automaton-scheme": {
    en: "the automaton scheme — a graph whose vertices are states, plus an alphabet; the aliases return the map (vertices to states)",
    fr: "le schéma d'automate — un graphe dont les sommets sont des états, plus un alphabet ; les alias retournent la carte (vertices → states)",
  },
  "petrinet-behavior": {
    en: "the behavior, parameterized by the net — a state's type refines the petrinet parameter, resolved late by the reading layer",
    fr: "le comportement, paramétré par le réseau — le type d'un état raffine le paramètre petrinet, résolu tard par la couche lisante",
  },
  "petrinet-statespace": {
    en: "the state space — an automaton parameterized by the net: a petrinet slot typed petrinet-scheme, state_type descends from the behavior",
    fr: "l'espace d'états — un automate paramétré par le réseau : slot petrinet typé petrinet-scheme, state_type descend du behavior",
  },
  "ss-pn-philosophers-5": {
    en: "the dinner's state space: the petrinet slot laid on the dinner — every reader will resolve it late",
    fr: "l'espace d'états du dîner : le slot petrinet posé au dîner — tout lecteur le résoudra tard",
  },
  "ss-pn-philosophers-5-inst": {
    en: "one state: s1 lays only philo1.think1 = 2 — philo1.eat1 = 0 and philo1.fork1 = 1 inherited from the dinner through the state type; b1 binds philo1.take1",
    fr: "un état : s1 ne pose que philo1.think1 = 2 — philo1.eat1 = 0 et philo1.fork1 = 1 hérités du dîner à travers le type d'état ; b1 lie philo1.take1",
  },
  "kahn-scheme": {
    en: "the 2nd family: processes / channels, writes / reads — refines bipartite-digraph like ps",
    fr: "2ᵉ famille : processus / canaux, écritures / lectures — raffine bipartite-digraph comme ps",
  },
  "graph-display": {
    en: "the generic lens: circle and line for every digraph descendant",
    fr: "lentille générique : cercle et trait pour tout descendant du digraphe",
  },
  "petrinet-display": {
    en: "the Petri lens: ellipse / rectangle / 2-port arc — multi-refines generic + scheme",
    fr: "lentille Petri : ellipse / rectangle / arc à 2 ports — multi-rafine générique + schéma",
  },
  "kahn-display": {
    en: "the Kahn lens: process/channel boxes — multi-refines generic + the Kahn scheme",
    fr: "lentille Kahn : boîtes process/canal — multi-rafine générique + schéma Kahn",
  },
  "view-scheme": {
    en: "the viewpoint scheme: model / display / zoom slots",
    fr: "schéma de point de vue : slots model / display / zoom",
  },
  "petrinet-view": {
    en: "the family viewpoint: a bound lens, an unbound model (late binding)",
    fr: "point de vue de famille : lentille liée, modèle non lié (liaison tardive)",
  },
  "pn-philosophers-5-course": {
    en: "a concrete viewpoint: the dinner through the Petri lens, positions = decisions",
    fr: "point de vue concret : le dîner par la lentille Petri, positions = décisions",
  },
  "kahn-course": {
    en: "the same dinner, the Kahn gaze: a legal degradation to the circle",
    fr: "le même dîner, regard Kahn : dégradation légale au cercle",
  },
  "wb-course": {
    en: "the diamond viewpoint: wb1 through the generic lens — the weights read through the diamond",
    fr: "point de vue du diamant : wb1 par la lentille générique — les poids se lisent à travers le diamant",
  },
};

/** The corpus layers that carry a role sentence, in declaration order. */
export function layerRoleNames(): string[] {
  return Object.keys(LAYER_ROLE);
}

/** The color class of each corpus layer (Tailwind badge colors). */
export const LAYER_COLOR: Record<string, string> = {
  record: "bg-slate-500",
  collection: "bg-indigo-400",
  "positions-scheme": "bg-teal-600",
  "positions-grid": "bg-teal-400",
  "positions-polar": "bg-teal-300",
  multihypergraph: "bg-orange-400",
  hypergraph: "bg-orange-200",
  "uniform-hypergraph": "bg-orange-300",
  "named-ends-hypergraph": "bg-orange-300",
  "pair-graph": "bg-orange-300",
  graph: "bg-orange-100",
  "graph-with-positions": "bg-amber-200",
  multidigraph: "bg-orange-600",
  digraph: "bg-orange-700",
  "oriented-graph": "bg-orange-800",
  dag: "bg-amber-400",
  tree: "bg-amber-500",
  "sperner-hypergraph": "bg-amber-300",
  "k-partite-hypergraph": "bg-orange-500",
  "mixed-graph": "bg-orange-400",
  "bipartite-digraph": "bg-orange-800",
  "weighted-hypergraph": "bg-amber-600",
  "vertex-annotated-hypergraph": "bg-orange-500",
  "edge-annotated-hypergraph": "bg-orange-400",
  "weighted-bipartite": "bg-red-600",
  "petrinet-scheme": "bg-sky-500",
  "pn-philosophers": "bg-violet-500",
  "pn-philosophers-1": "bg-emerald-500",
  "pn-philosophers-5": "bg-emerald-400",
  "pn-philosophers-5-bounds": "bg-teal-500",
  "pn-philosophers-5-bounds-c1": "bg-rose-500",
  wb1: "bg-emerald-700",
  "automaton-scheme": "bg-cyan-500",
  "petrinet-behavior": "bg-cyan-400",
  "petrinet-statespace": "bg-cyan-800",
  "ss-pn-philosophers-5": "bg-blue-500",
  "ss-pn-philosophers-5-inst": "bg-blue-700",
  "kahn-scheme": "bg-lime-600",
  "graph-display": "bg-cyan-600",
  "petrinet-display": "bg-fuchsia-600",
  "kahn-display": "bg-pink-600",
  "view-scheme": "bg-slate-700",
  "petrinet-view": "bg-indigo-600",
  "pn-philosophers-5-course": "bg-emerald-600",
  "kahn-course": "bg-rose-700",
  "wb-course": "bg-amber-700",
  // the tutorial corpus names — the dedicated hierarchy the tutorial
  // page flattens; the same map feeds their badges, the hues mirror
  // the kernel's analogues (petri sky, philosophers violet/emerald,
  // the automaton line cyan, the state space blue)
  petrinet: "bg-sky-500",
  philosophers: "bg-violet-500",
  "philosophers-5": "bg-emerald-400",
  automaton: "bg-cyan-500",
  "state-space": "bg-cyan-800",
  "philosophers-5-state-space": "bg-blue-500",
};

/** The refinement DAG of the workshop: the targets and children of
 * each layer, with the rank (depth of the longest path to a base)
 * — the generations align in horizontal bands. Extensible at
 * runtime: staged additions enter the living inventory, the corpus
 * ranks stay frozen. */
export class RefinementDag {
  private readonly targets: Record<string, string[]> = {};
  private readonly children: Record<string, string[]> = {};
  private readonly ranks: Record<string, number> = {};

  constructor({ space, layerNames }: { space: Space; layerNames: readonly string[] }) {
    // the graph is read in the kernel space, never copied blindly
    for (const layerName of layerNames) {
      const layerTree: any = space.layers[layerName];
      this.targets[layerName] = ((layerTree && layerTree["refines"]) ?? [])
        .filter((entry: any) => entry instanceof LayerReference)
        .map((entry: any) => entry.layer);
    }
    for (const layerName of layerNames) this.children[layerName] = [];
    for (const layerName of layerNames) {
      for (const parent of this.targets[layerName] ?? []) {
        const siblings = this.children[parent];
        if (siblings === undefined) continue;
        siblings.push(layerName);
      }
    }
    for (const layerName of layerNames) this.computeRank(layerName, new Set());
  }

  /** The memoized rank of a layer (computed for every inventoried
   * layer at construction or addition). */
  rank(layerName: string): number {
    return this.ranks[layerName] ?? 0;
  }

  /** Rank of a layer: depth of the longest path towards a base.
   * Guard: an eventual cycle in the data would not freeze the view. */
  private computeRank(layerName: string, seenLayers: Set<string>): number {
    const knownRank = this.ranks[layerName];
    if (knownRank !== undefined) return knownRank;
    if (seenLayers.has(layerName)) return 0;
    seenLayers.add(layerName);
    const parents = this.targets[layerName] ?? [];
    const rank = parents.length
      ? 1 + Math.max(...parents.map((parent) => this.computeRank(parent, seenLayers)))
      : 0;
    this.ranks[layerName] = rank;
    return rank;
  }

  targetsOf(layerName: string): string[] {
    return this.targets[layerName] ?? [];
  }

  childrenOf(layerName: string): string[] {
    return this.children[layerName] ?? [];
  }

  /** The closure of a layer towards the bases (itself included). */
  ancestorsOf(layerName: string): Set<string> {
    const ancestors = new Set<string>([layerName]);
    const todo: string[] = [layerName];
    while (todo.length) {
      const current = todo.pop()!;
      for (const parent of this.targetsOf(current)) {
        if (!ancestors.has(parent)) {
          ancestors.add(parent);
          todo.push(parent);
        }
      }
    }
    return ancestors;
  }

  /** The closure of a layer towards the descendants (itself included). */
  descendantsOf(layerName: string): Set<string> {
    const descendants = new Set<string>([layerName]);
    const todo: string[] = [layerName];
    while (todo.length) {
      const current = todo.pop()!;
      for (const child of this.childrenOf(current)) {
        if (!descendants.has(child)) {
          descendants.add(child);
          todo.push(child);
        }
      }
    }
    return descendants;
  }

  /** Enter a staged addition into the living inventory. */
  addLayer({ layerName, targets }: { layerName: string; targets: string[] }): void {
    this.targets[layerName] = targets;
    this.children[layerName] = [];
    for (const parent of targets) {
      if (this.children[parent] !== undefined) this.children[parent].push(layerName);
    }
    this.computeRank(layerName, new Set());
  }

  /** Re-aim an existing layer after an accepted edition: its
   * refinement targets may have changed — it leaves its old
   * parents before joining the new ones, and the ranks are
   * recomputed (the graph is a projection of the space, never a
   * copy). */
  retargetLayer({ layerName, targets }: { layerName: string; targets: string[] }): void {
    for (const parent of Object.keys(this.children)) {
      this.children[parent] = (this.children[parent] ?? []).filter((child) => child !== layerName);
    }
    this.targets[layerName] = targets;
    if (this.children[layerName] === undefined) this.children[layerName] = [];
    for (const parent of targets) {
      if (this.children[parent] !== undefined) this.children[parent].push(layerName);
    }
    // the ranks are memoized per layer — an edition may change the
    // depth of anyone downstream, everything is recomputed
    for (const name of Object.keys(this.targets)) delete this.ranks[name];
    for (const name of Object.keys(this.targets)) this.computeRank(name, new Set());
  }
}

/** One laid-out node of the graph. */
export interface GraphNodePosition {
  x: number;
  y: number;
  w: number;
}

/** The deterministic layout of the refinement graph: node width
 * measured on its name, two downward then two upward barycenter
 * sweeps in pixels (parents pull their children close, children
 * push their parents — crossings decrease, the result is
 * deterministic), bands centered. */
export function computeGraphLayout({
  layerNames,
  dag,
}: {
  layerNames: readonly string[];
  dag: RefinementDag;
}): {
  W: number;
  H: number;
  position: (layerName: string) => GraphNodePosition;
  rows: string[][];
  ROW: number;
} {
  const CHARACTER_WIDTH = 5.8; // width of one character in font-mono 9px
  const NODE_PADDING = 36; // pastille + internal margins of the node
  const HORIZONTAL_GAP = 16; // horizontal gap between nodes of a band
  const ROW = 46; // height of one generation

  const widthOf = (layerName: string) =>
    Math.ceil(layerName.length * CHARACTER_WIDTH) + NODE_PADDING;
  const maxRank = Math.max(...layerNames.map((layerName) => dag.rank(layerName)));
  const rows: string[][] = [];
  for (let rank = 0; rank <= maxRank; rank++) {
    rows.push(layerNames.filter((layerName) => dag.rank(layerName) === rank));
  }

  // ---- place each band left to right, remembering band centers ----
  const centerX: Record<string, number> = {};
  const placeRow = (row: string[]) => {
    let cursor = 0;
    for (const layerName of row) {
      centerX[layerName] = cursor + widthOf(layerName) / 2;
      cursor += widthOf(layerName) + HORIZONTAL_GAP;
    }
  };
  for (const row of rows) placeRow(row);

  // ---- the barycenter sweeps: downward (parents pull), then
  // upward (children push) — ties keep the inventory order, the
  // result is deterministic ----
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let rank = 1; rank <= maxRank; rank++) {
      const scored = (rows[rank] ?? []).map((layerName) => {
        const parentCenters = dag.targetsOf(layerName).map((parent) => centerX[parent] ?? 0);
        return {
          layerName,
          barycenter: parentCenters.length
            ? parentCenters.reduce((total, center) => total + center, 0) / parentCenters.length
            : (centerX[layerName] ?? 0),
        };
      });
      scored.sort(
        (first, second) =>
          first.barycenter - second.barycenter ||
          layerNames.indexOf(first.layerName) - layerNames.indexOf(second.layerName),
      );
      rows[rank] = scored.map((scoredNode) => scoredNode.layerName);
      placeRow(rows[rank] ?? []);
    }
    for (let rank = maxRank - 1; rank >= 0; rank--) {
      const scored = (rows[rank] ?? []).map((layerName) => {
        const childCenters = dag.childrenOf(layerName).map((child) => centerX[child] ?? 0);
        return {
          layerName,
          barycenter: childCenters.length
            ? childCenters.reduce((total, center) => total + center, 0) / childCenters.length
            : (centerX[layerName] ?? 0),
        };
      });
      scored.sort(
        (first, second) =>
          first.barycenter - second.barycenter ||
          layerNames.indexOf(first.layerName) - layerNames.indexOf(second.layerName),
      );
      rows[rank] = scored.map((scoredNode) => scoredNode.layerName);
      placeRow(rows[rank] ?? []);
    }
  }

  // ---- center each band horizontally ----
  const rowWidths = rows.map((row) =>
    (row ?? []).reduce(
      (total, layerName) => total + widthOf(layerName) + HORIZONTAL_GAP,
      -HORIZONTAL_GAP,
    ),
  );
  const W = Math.max(...rowWidths) + 2;
  for (let rank = 0; rank <= maxRank; rank++) {
    const offset = (W - (rowWidths[rank] ?? 0)) / 2;
    for (const layerName of rows[rank] ?? [])
      centerX[layerName] = (centerX[layerName] ?? 0) + offset;
  }

  const H = 30 + (maxRank + 1) * ROW + 14;
  const position = (layerName: string): GraphNodePosition => ({
    x: (centerX[layerName] ?? 0) - widthOf(layerName) / 2,
    y: 30 + dag.rank(layerName) * ROW,
    w: widthOf(layerName),
  });
  return { W, H, position, rows, ROW };
}
