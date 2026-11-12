// ---- attributes axis — weighted-hypergraph: a weight slot on
//      the edge, unbound type — each family fixes it in its
//      refinement (unit-weighted-hypergraph below is the bound
//      case: default 1). Weight is an annotation axis, orthogonal
//      to orientation: the slot lives on its own member, no key
//      leaks to the models.
layer weighted-hypergraph refines @edge-annotated-hypergraph
  extend edge_type
    extend specification
      extend record
        abstract weight
