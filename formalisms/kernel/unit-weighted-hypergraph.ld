// ---- the bound case — unit-weighted-hypergraph: the weight slot
//      fixed to integers with default 1 (parent member at the same
//      path). This is the layer the concrete weighted families
//      (weighted-bipartite, P/T Petri nets) refine when they want
//      the unit default; weighted-hypergraph itself stays abstract.
layer unit-weighted-hypergraph refines @weighted-hypergraph
  extend edge_type
    weight = 1
