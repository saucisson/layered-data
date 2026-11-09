// ---- k-partite-hypergraph — the generalized partition axis: vertices
//      partition into k named classes — the concrete sources of the
//      "vertices" alias of the refinement (places/transitions,
//      left/right…) — and every edge touches at most one vertex per
//      class. Thin layer: the partition lives in the refinements (as
//      named-ends states the idiom, k-partite states the partition);
//      the check, driven by the types, is alias-safe: it reads the
//      partition in the view and stays silent if the alias does not
//      exist. Bipartite is the k = 2 specialization:
//      bipartite-digraph refines [multidigraph, k-partite-hypergraph].
//      NOTE (ADR-0022 strate 2): "same class" is not first-order; the
//      check stays algorithmic until strate 2 lands.
layer k-partite-hypergraph refines @multihypergraph
  check k-partite
