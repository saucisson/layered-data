// ---- generalized-arity axis — uniform-hypergraph: arity is a
//      bindable datum: the bounds of the arrows collection become
//      an unbound slot — the k-uniform refinement will bind both to
//      k. The 2-uniform is pair-graph (special case): pair-graph
//      refines the base directly, going through the uniform would
//      descend an arity key to all descendants.
layer uniform-hypergraph refines @multihypergraph
  edge_type refines @multihypergraph/specification/edge_type
    extend arrows
      extend specification
        extend collection
          override abstract minimum
          override abstract maximum
