// ---- the diamond model: a weighted bipartite graph. e1 carries its
//      weight (3); e2 does not — its descends from the diamond
//      (weighted-hypergraph, default 1). Explicit refines: desugaring
//      is moot here.
layer wb1 refines @weighted-bipartite
  extend left
    a1 refines @wb1/specification/left_type
      identifier = 1
    a2 refines @wb1/specification/left_type
      identifier = 2
  extend right
    b1 refines @wb1/specification/right_type
      identifier = 1
  extend arcsAB
    e1 refines @wb1/specification/arcAB_type
      source = @wb1/left/a1
      target = @wb1/right/b1
      override weight = 3
    e2 refines @wb1/specification/arcAB_type
      source = @wb1/left/a2
      target = @wb1/right/b1
