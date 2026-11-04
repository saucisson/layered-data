// ---- digraph — arcs purs : l'orientation (multidigraph) croisée
//      avec la pureté (hypergraph). Ni arcs parallèles ni
//      boucles-arcs, 2-cycles légaux (le « simple digraph » de la
//      théorie). Le check simple, hérité de hypergraph, y porte sur
//      la paire ordonnée (multidigraph dans la chaîne). Diamant pur.
layer digraph refines @multidigraph then @hypergraph
