// ---- annotation axis (edges) — edge-annotated-hypergraph: same
//      idiom as vertex-annotated on the edge (root, same path as
//      multidigraph :: edge_type — without merging into it: the
//      layer lives on the undirected side; an arc is an oriented
//      edge, above orientation the word is edge).
//      weighted-hypergraph below is the bound case: weight is an
//      annotation whose type is fixed (default 1).
layer edge-annotated-hypergraph refines @multihypergraph
  edge_type
    specification
      record
        abstract annotation
