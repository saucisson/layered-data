// ---- sperner-hypergraph — l'antichaîne (clutter) : aucune arête
//      n'en contient une autre. Raffine la pureté ; check au
//      niveau couche, ensemble d'extrémités.
layer sperner-hypergraph refines @hypergraph
  check sperner
