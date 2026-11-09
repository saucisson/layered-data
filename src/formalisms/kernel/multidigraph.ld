// ---- multidigraph: orientation is a renaming of the connection
//      points. Refines named-ends-hypergraph (the trunk of named
//      ends) and pair-graph (cardinality 2, without roles): 2 named
//      arrows source and target pointing the edge's own fields. The
//      name is mathematical: the base allows parallel arcs and
//      loops, and both parents live on the multi side — it is a
//      multidigraph. Naming convention: arc (and the -digraph
//      suffix) from here on; edge above orientation.
layer multidigraph refines @named-ends-hypergraph then @pair-graph
  // the ordered idiom binds here (first-winner per slot: more
  // specific than the base, it wins down the whole chain) — the
  // checks read the "ordered" binding, never the layer name.
  // LAYER-level binding: it lives at the root, where the layer
  // checks read it.
  bind ordered -> true
  extend edge_type refines @multihypergraph/specification/edge_type
    // same path as the root: redefinition of the graph's edge
    // TYPE-level bindings: the arc checks (oriented, dag) and the
    // ordered pair read at the arc's address — the type is in the
    // arc's closure, the root never is. The source/target roles
    // therefore live here, within actual reading range.
    bind end-source -> "source"
    bind end-target -> "target"
    extend specification
      extend record
        source
          container = @multidigraph/vertices
        target
          container = @multidigraph/vertices
    extend arrows
      source
        vertex = @edge_type/source
      target
        vertex = @edge_type/target
