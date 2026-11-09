// ---- sperner-hypergraph — the antichain (clutter): no edge contains
//      another. Refines purity; check at layer level, set of ends.
layer sperner-hypergraph refines @hypergraph
  check sperner
    level = "root"
    judgment
      formula = "forall e1, e2 in edges: (e1 = e2) or (exists v in vertices: (exists a in e2/arrows: a/vertex = v) and (not (exists a in e1/arrows: a/vertex = v)))"
      message = "sperner: edge {e2} contained in {e1}"
