// ---- le diamant : weighted-bipartite — héritage multiple au
//      niveau couche : raffine bipartite-digraph et
//      weighted-hypergraph. Juste les deux LRefs, pas de nœud de
//      jonction : un specification/arcAB_type propre s'auto-
//      référencerait à la résolution (garde de cycle) et
//      rétrograderait la voie bipartite en membre du père, derrière
//      le record générique. Sans lui, l'arcAB_type de bd, lu depuis
//      wb1, re-racine son R(bd, edge_type) dans la chaîne du
//      diamant : le record croisé de bd arrive en tête, et l'arête
//      de la vue embarque le poids.
layer weighted-bipartite refines @bipartite-digraph then @weighted-hypergraph
