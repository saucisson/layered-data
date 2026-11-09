// ---- the base — multihypergraph: formalisms are defined by
//      restricting a more general formalism — generality is the
//      base. Vertices and edges, typed (identifier) and stored in
//      two keyed collections; incidence is carried: each edge
//      points its vertices through arrows (arrow_type), any number
//      — free arity is the base's law. Multiplicity is the
//      unmarked normal of the mechanism: edges are identified by
//      key, not by their ends, and the same set of ends may be
//      linked several times. A default permission carries no name;
//      only its restricting opposite gets one (hypergraph, below).
layer multihypergraph refines @record
  // the base's vocabulary is a data binding (special key
  // "bindings"): the generic checks do not read these names
  // hardcoded, they read the slots — the base binds them. A
  // refinement that renames re-binds the slot, the check follows
  // the view.
  bind vertices -> "vertices"
  bind edges -> "edges"
  bind ordered -> false
  bind arrows -> "arrows"
  bind arrow-vertex -> "vertex"
  extend specification
    vertex_type refines @record
      extend specification
        extend record
          abstract identifier
    edge_type refines @record
      extend specification
        extend record
          abstract identifier
      // an arrow points a vertex of the base
      arrow_type refines @record
        extend specification
          extend record
            vertex
              container = @multihypergraph/vertices
      arrows refines @collection
        extend specification
          extend collection
            override type = @multihypergraph/specification/edge_type/arrow_type
  vertices refines @collection
    extend specification
      extend collection
        override type = @multihypergraph/specification/vertex_type
  edges refines @collection
    extend specification
      extend collection
        override type = @multihypergraph/specification/edge_type
