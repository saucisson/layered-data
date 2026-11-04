// ---- axe arité généralisé — uniform-hypergraph : l'arité est une
//      donnée liable : les bornes de la collection des flèches
//      deviennent un slot non lié — le raffinement k-uniforme liera
//      les deux à k. Le 2-uniforme est pair-graph (cas particulier) :
//      pair-graph raffine la base directement, passer par l'uniforme
//      ferait descendre une clé d'arité vers tous les descendants.
layer uniform-hypergraph refines @multihypergraph
  edge_type refines @multihypergraph/specification/edge_type
    extend arrows
      extend specification
        extend collection
          override abstract minimum
          override abstract maximum
