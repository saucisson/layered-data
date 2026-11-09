// ---- trunk — named-ends-hypergraph: an edge's ends are named
//      arrows, free cardinality, and an arrow may designate a field
//      of the edge itself (self-designation: the
//      Ref(edge_type, [field]) idiom that multidigraph uses below
//      for source/target). Thin layer: it states the idiom, its
//      content stays in its refinements. Naming convention: as long
//      as arity is not restricted to 2, the suffix is "-hypergraph";
//      "-graph" expects the pair.
layer named-ends-hypergraph refines @multihypergraph
