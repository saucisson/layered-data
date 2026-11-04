// ---- axe annotation (arêtes) — edge-annotated-hypergraph :
//      même idiome que vertex-annotated sur l'arête (racine, même
//      chemin que multidigraph :: edge_type — sans y fusionner : la
//      couche vit du côté non orienté ; un arc est une arête
//      orientée, au-dessus de l'orientation le mot est edge).
//      weighted-hypergraph ci-dessous en est le cas lié : weight est
//      une annotation dont le type est fixé (défaut 1).
layer edge-annotated-hypergraph refines @multihypergraph
  edge_type
    specification
      record
        abstract annotation
