// The guided tour scenarios (S1–S14): the workshop opens on the
// workspace — no active scenario at rest; the tour stays one click
// away, folded in the header. Each scenario pins an address (layer,
// path, key) and tells its story — bilingual UI data.

import type { BilingualText } from "./i18n.ts";

/** One scenario of the guided tour: an address to pin, a story to
 * tell. */
export interface WorkshopScenario {
  id: string;
  label: BilingualText;
  layer: string;
  path: string[];
  key: string | null;
  text: BilingualText;
}

export const WORKSHOP_SCENARIOS = [
  {
    id: "S1",
    label: {
      en: "Inherited marking",
    },
    layer: "pn-philosophers-5-bounds-c1",
    path: ["places", "philo1.think1"],
    key: "marking",
    text: {
      en: "pn-philosophers-5-bounds-c1 stores only bound for philo1.think1 — no marking. Yet marking reads: the closure walks the types (pn-philosophers::specification/think, petrinet-scheme::specification/place_type…), which provide declarations only, then reaches last the member of the parent: the dinner's philo1.think1 — the QUALIFIED member that the citation of philo1 generated (template pn-philosophers-1 :: places/think1), which carries the value 1. Instance inheritance is not a copy — it is this walk.",
    },
  },
  {
    id: "S2",
    label: {
      en: "Local shadow",
    },
    layer: "pn-philosophers-5-bounds-c1",
    path: ["places", "philo1.think1"],
    key: "bound",
    text: {
      en: "bound is provided by the c1 layer's own node: first-wins, the read stops at the first source. Every later source of the chain is « not reached » — it is not even consulted.",
    },
  },
  {
    id: "S3",
    label: {
      en: "The type's default",
    },
    layer: "pn-philosophers-1",
    path: ["arcs", "pt1"],
    key: "weight",
    text: {
      en: "The template's arc pt1 stores only source and target (it lives in pre_arcs; the arcs alias reaches it, like vertices in S4). weight comes from the type pn-philosophers :: specification/arc_type, which carries the default 1 — reached as « member of the parent » at the arc type's crossing. Further along, petrinet-scheme declares the weight field but as an abstract slot ∅ — transparent, it decides nothing.",
    },
  },
  {
    id: "S4",
    label: {
      en: "The vertices alias",
    },
    layer: "pn-philosophers-5",
    path: ["vertices"],
    key: null,
    text: {
      en: "vertices does not exist in the dinner: it is petrinet-scheme's alias, which refines places and transitions. The closure pushes the union of the two collections — all their concrete sources. The visible keys enumerate the 15 places then the 10 transitions.",
    },
  },
  {
    id: "S5",
    label: {
      en: "Resolving a reference",
    },
    layer: "pn-philosophers-1",
    path: ["arcs", "pt1"],
    key: "source",
    text: {
      en: "source reads → (pn-philosophers-1) places/think1. The anchor « pn-philosophers-1 » is looked up among the anchors of the holder pn-philosophers-1 :: arcs/pt1's prefixes (local anchors ✗, then the root ✓, where it is a layer name of the chain): re-rooting in the current view, then the read places › think1 — the designated address is pn-philosophers-1 :: places/think1.",
    },
  },
  {
    id: "S6",
    label: {
      en: "The gaze is data",
    },
    layer: "pn-philosophers-5-course",
    path: [],
    key: "display",
    text: {
      en: "pn-philosophers-5-course stores only model, zoom and the positions. The display slot is inherited: the read walks the chain [pn-philosophers-5-course, petrinet-view, view-scheme, record] and stops at the first definer — petrinet-view, which binds the petrinet-display lens by LRef. The LRef value resolves to an address: the petrinet-display node. The viewpoint is a layer: refinable, addressable, shareable. The full rendering is the pair (model, viewpoint), panel ④.",
    },
  },
  {
    id: "S7",
    label: {
      en: "The multi-refining lens",
    },
    layer: "petrinet-display",
    path: [],
    key: null,
    text: {
      en: "petrinet-display refines two layers: the generic lens graph-display and the petrinet-scheme scheme (multi-LRef). Its visible keys therefore enumerate the scheme's vocabulary (places, transitions, pre_arcs, post_arcs, arcs, vertices, edges). And also left / right / arcsAB / arcsBA inherited from bipartite-digraph. The lens knows what the model it dresses talks about, without knowing a single datum of the dinner. The templates dress types, not nodes.",
    },
  },
  {
    id: "S8",
    label: {
      en: "Orienting, without a « directed graph »",
    },
    layer: "multidigraph",
    path: ["edge_type", "arrows"],
    key: "source",
    text: {
      en: "Orientation lives inside this formalism, multidigraph — no separate « directed graph » layer. The base leaves parallel arcs and loops permitted there: this is therefore a multidigraph. An edge has exactly 2 arrows (cardinality inherited from pair-graph, the arity axis): source and target. The source arrow points the vertex attribute → (edge_type) source, the edge's attribute — the edge_type anchor resolves at the holder's prefix [edge_type]. Follow vertex: it designates the arc's source, wherever it is.",
    },
  },
  {
    id: "S9",
    label: {
      en: "Splitting in two, without a « bipartite graph »",
    },
    layer: "petrinet-scheme",
    path: ["specification", "pre_arc_type", "specification", "record"],
    key: "source",
    text: {
      en: "No « bipartite graph » layer: the bipartition expresses itself in petrinet-scheme, through two arc types with crossed containers. The bipartite-digraph layer (left / right, arcsAB / arcsBA) generalizes this idiom — the k = 2 specialization of k-partite-hypergraph, which ps refines. Pre_arc_type keeps its containers: source in places, target in transitions. Read source: the container → (petrinet-scheme) places restricts every pre arc's source to a place. The template follows: pt1 and er1 refine pre_arc_type, te1 refines post_arc_type.",
    },
  },
  {
    id: "S10",
    label: {
      en: "The diamond of wb1",
    },
    layer: "wb1",
    path: ["arcsAB", "e2"],
    key: "weight",
    text: {
      en: "wb1 refines weighted-bipartite, which refines bipartite-digraph and weighted-hypergraph: multiple inheritance at the layer level. e2 carries no weight. Its chain (panel ③) walks bipartite-digraph :: specification/arcAB_type (the crossed record, no weight), then multidigraph :: edge_type (the oriented edge, nothing), and finally weighted-hypergraph :: edge_type, which carries weight = 1 — the first definer. e1, for its part, carries 3: first-wins, it does not even reach the default. Two axes, one model, no copy. Panel ④ draws it (card « The weighted diamond »).",
    },
  },
  {
    id: "S11",
    label: {
      en: "Two parents for one type",
    },
    layer: "petrinet-scheme",
    path: ["specification", "pre_arc_type"],
    key: null,
    text: {
      en: "Multiple inheritance at the type level: pre_arc_type refines two layers — petrinet-scheme :: specification/arc_type (the weight) and bipartite-digraph :: specification/arcAB_type (the crossed A→B arc). Panel ③ shows both refines resolved. The order encodes the specificity. The Petri type first: its crossed record arrives at the head of the instances' chain. The partition axis next. A template's pre arc is a Petri arc, and a crossed arc of a bipartite digraph.",
    },
  },
  {
    id: "S12",
    label: {
      en: "The triple inheritance",
    },
    layer: "petrinet-scheme",
    path: [],
    key: null,
    text: {
      en: "petrinet-scheme refines three axes: bipartite-digraph (the k = 2 partition), vertex-annotated-hypergraph and edge-annotated-hypergraph (the annotation of the vertices and that of the edges). The marking (places) and the weight (arcs) live there as unbound generic slots: place_type inherits the generic annotation slot from the vertex-annotated-hypergraph way, parallel to its own marking; arc_type likewise with weight and annotation. The generic slot stays unbound — the variant binds: petrinet-pt binds marking to natural, weighted-hypergraph binds its own to an integer (default 1).",
    },
  },
  {
    id: "S13",
    label: {
      en: "The recast base",
    },
    layer: "multihypergraph",
    path: [],
    key: null,
    text: {
      en: "The base of the graphs. Formalisms define themselves by restriction of a more general formalism: generality is the base. The multihypergraph layer carries the whole encoding — typed vertices and edges (identifier), incidence by arrows in any number. Free arity is the base's law, pair-graph the bound at 2 by the arity axis. Multiplicity and intra-edge repetition are the mechanism's unmarked normality. This is the multihypergraph of the usual definitions: a default permission carries no name, only its restrictive opposite does — hypergraph, the pure layer (generalized simple check: unique edges + no intra-repetition + nonempty). The annotation axes live hoisted directly under the base: annotating does not orient. And multidigraph keeps the named-ends idiom (named-ends-hypergraph: an arrow may designate a field of the edge itself) plus arity 2 (pair-graph), renaming those points source/target. The models' reads depend only on the base's anchors (golden reads contract).",
    },
  },
  {
    id: "S14",
    label: {
      en: "The state inherits the net",
    },
    layer: "ss-pn-philosophers-5-inst",
    path: ["states", "s1"],
    key: "marking",
    text: {
      en: "s1 lays only places::philo1.think1 = 2 — nothing else. Yet philo1.eat1 = 0 and philo1.fork1 = 1 read. The closure of s1 walks its state type (petrinet-statespace::specification/state_type → petrinet-behavior — a state's type refines the petrinet parameter), which binds late to the dinner laid by ss-pn-philosophers-5. And the read descends the net's places. A state is « the net with a certain marking »: the delta is laid, the type is the net. Measured: closure of s1 containing the dinner, philo1.eat1 = 0 inherited, philo1.think1 = 2 overridden, b1 → the dinner's philo1.take1 (generated by the citation of the template).",
    },
  },
];
