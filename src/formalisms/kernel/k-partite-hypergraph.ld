// ---- k-partite-hypergraph — l'axe partition généralisé : les
//      sommets se partitionnent en k classes nommées — les sources
//      concrètes de l'alias « vertices » du raffinement
//      (places/transitions, left/right…) — et chaque arête touche au
//      plus un sommet par classe. Couche mince : la partition vit
//      dans les raffinements (comme named-ends énonce l'idiome,
//      k-partite énonce la partition) ; le check, piloté par les
//      types, est alias-safe : il lit la partition dans la vue et se
//      tait si l'alias n'existe pas. Le bipartite en est la
//      spécialisation k = 2 : bipartite-digraph raffine
//      [multidigraph, k-partite-hypergraph].
layer k-partite-hypergraph refines @multihypergraph
  check k-partite
