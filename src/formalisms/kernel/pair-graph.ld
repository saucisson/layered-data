// ---- bounded-arity axis — pair-graph: exactly 2 arrows per
//      edge, without roles: an undirected graph (a pair).
//      Refines the base directly. Orientation lives in
//      multidigraph.
layer pair-graph refines @multihypergraph
  edge_type refines @multihypergraph/specification/edge_type
    // direct crossing as the published graph (same path as the
    // root: edge redefinition)
    extend arrows
      extend specification
        extend collection
          override minimum = 2
          override maximum = 2
