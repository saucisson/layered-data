// ---- attributes axis — weighted-hypergraph: a weight slot on
//      the edge, with default 1 (parent member at the same path).
//      Weight is an annotation axis, orthogonal to orientation:
//      the slot lives on its own member, no key leaks to the
//      models. The diamond depends on it: weighted-bipartite =
//      [bipartite-digraph, weighted-hypergraph], the weight always
//      descends through the diamond's second path.
layer weighted-hypergraph refines @edge-annotated-hypergraph
  extend edge_type
    weight = 1
    extend specification
      extend record
        abstract weight
