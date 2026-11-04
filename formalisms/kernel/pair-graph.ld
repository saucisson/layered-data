// ---- axe arité borné — pair-graph : exactement 2 flèches par
//      arête, sans rôles : un graphe non orienté (une paire).
//      Raffine la base directement. L'orientation vit dans
//      multidigraph.
layer pair-graph refines @multihypergraph
  edge_type refines @multihypergraph/specification/edge_type
    // croisement direct comme le graph publié (même chemin que la
    // racine : redéfinition de l'arête)
    extend arrows
      extend specification
        extend collection
          override minimum = 2
          override maximum = 2
