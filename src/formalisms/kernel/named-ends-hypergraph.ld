// ---- tronc — named-ends-hypergraph : les extrémités d'une
//      arête sont des flèches nommées, à cardinalité libre, et une
//      flèche peut désigner un champ de l'arête elle-même
//      (auto-désignation : l'idiome Ref(edge_type, [champ]) que
//      multidigraph utilise ci-dessous pour source/target). Couche
//      mince : elle énonce l'idiome, son contenu reste dans ses
//      raffinements. Convention de nommage : tant que l'arité n'est
//      pas restreinte à 2, le suffixe est « -hypergraph » ;
//      « -graph » attend la paire.
layer named-ends-hypergraph refines @multihypergraph
