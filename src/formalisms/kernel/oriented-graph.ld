// ---- oriented-graph — le sens strict du mathématicien : un
//      graphe orienté sans couple d'arcs opposés. À ne pas confondre
//      avec multidigraph, qui porte la multiplicité de la base :
//      l'orientation stricte est ici. Check par adresse d'arc.
layer oriented-graph refines @digraph
  extend edge_type
    check oriented
