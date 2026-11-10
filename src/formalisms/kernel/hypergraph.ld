// ---- the named restriction — hypergraph: the pure multihypergraph.
//      E is a set of non-empty parts: unique edges (no two edges for
//      the same set of ends), no intra-edge repetition (an edge is a
//      set, not a multiset — singletons stay legal: excluding them
//      would be a loopless-hypergraph layer, not posed).
//
//      ADR-0105: the constraint is a COUPLE — defining a check is also
//      posing it. The formula speaks the definer's vocabulary (edges,
//      arrows, vertex) and reads as-is in every descendant; a formula's
//      universe is the declared vocabulary of its writer, never a layer
//      name. The branch follows the "ordered" binding (the bedrock's
//      only parameter-value, bound by the base and by multidigraph):
//      false, the edge is a set of ends — intra-edge repetition then
//      multiple edges; true, the ordered pair of fields — loop then
//      parallel arcs. A term in proposition position is the existence
//      predicate (an arrow may fail to denote): the guards state it,
//      never a slot. An edge without a denoting arrow is empty — the
//      base's law, referred here by "nonempty".
layer hypergraph refines @multihypergraph
  check simple
    level = "root"
    condition = "ordered"
    judgment
      when = "false"
      formula = "forall e in edges: forall a1, a2 in e/arrows: (not a1/vertex) or (not a2/vertex) or (a1 = a2) or (a1/vertex != a2/vertex)"
      message = "simple: repeated vertex ({e} : {a1/vertex*})"
    judgment
      when = "false"
      formula = "forall e1, e2 in edges: (e1 = e2) or (not (exists a in e1/arrows: a = a)) or (not (exists a in e2/arrows: a = a)) or (not ((forall v in vertices: ((exists a1 in e1/arrows: a1/vertex = v) => (exists a2 in e2/arrows: a2/vertex = v))) and (forall v in vertices: ((exists a1 in e2/arrows: a1/vertex = v) => (exists a2 in e1/arrows: a2/vertex = v)))))"
      message = "simple: multiple edge ({e1} == {e2})"
    judgment
      when = "true"
      formula = "forall e in edges: ((e/source) and (e/target)) => (not (e/source = e/target))"
      message = "simple: loop ({e} : {e/source*})"
    judgment
      when = "true"
      formula = "forall e1, e2 in edges: (e1 = e2) or (not e1/source) or (not e1/target) or (not e2/source) or (not e2/target) or (not ((e1/source = e2/source) and (e1/target = e2/target)))"
      message = "simple: multiple edge ({e1} == {e2} : ({e1/source*}, {e2/target*}))"
  check nonempty
    level = "root"
    judgment
      formula = "forall e in edges: exists a in e/arrows: a/vertex"
      message = "nonempty: empty edge ({e})"
