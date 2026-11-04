// ---- modèle du diamant : un graphe biparti pondéré. e1 porte son
//      weight (3) ; e2 non — le sien descend du diamant
//      (weighted-hypergraph, défaut 1). Refines explicites : le
//      désucrage est ici sans objet.
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
