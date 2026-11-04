// ---- la restriction nommée — hypergraph : le multihypergraphe
//      pur. E est un ensemble de parties non vides : arêtes uniques
//      (pas deux arêtes pour le même ensemble d'extrémités), pas de
//      répétition intra-arête (une arête est un ensemble, pas un
//      multiensemble — les singletons restent légaux : les exclure
//      serait une couche loopless-hypergraph, non posée). Les checks
//      sont des données, posées au niveau couche pour que la
//      contrainte voyage par composition.
layer hypergraph refines @multihypergraph
  check simple, nonempty
