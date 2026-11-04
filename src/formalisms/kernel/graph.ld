// ---- le graphe simple du mathématicien — graph : la composition
//      de la paire (pair-graph) et de la pureté (hypergraph) — un
//      hypergraphe 2-uniforme. Diamant pur : rien en propre, juste
//      les deux parents. L'orientation ne vit pas ici : elle est
//      dans multidigraph.
layer graph refines @pair-graph then @hypergraph
