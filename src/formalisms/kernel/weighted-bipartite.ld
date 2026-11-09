// ---- the diamond: weighted-bipartite — multiple inheritance at
//      layer level: refines bipartite-digraph and
//      weighted-hypergraph. Just the two LRefs, no junction node: a
//      own specification/arcAB_type would self-reference at
//      resolution (cycle guard) and demote the bipartite path to a
//      parent member, behind the generic record. Without it, bd's
//      arcAB_type, read from wb1, re-roots its R(bd, edge_type) in
//      the diamond's chain: bd's crossed record comes first, and the
//      view's edge carries the weight.
layer weighted-bipartite refines @bipartite-digraph then @weighted-hypergraph
