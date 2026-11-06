// ---- le graphe du tutoriel : le métamodèle de base. Des sommets
//      et des arcs, typés (identifier) et rangés dans deux
//      collections à clés ; chaque arc pointe ses deux bouts par
//      source et target, l'annotation container dit où vivent les
//      bouts. Deux étiquettes de check posées ici descendent dans
//      tout raffinement : containers (les bouts d'un arc sont des
//      sommets du réseau) et cardinality (une collection respecte
//      ses bornes).
layer graph refines @record
  check containers
  check cardinality
  extend specification
    vertex_type refines @record
      extend specification
        extend record
          abstract identifier
    edge_type refines @record
      extend specification
        extend record
          abstract identifier
          source
            container = @graph/vertices
          target
            container = @graph/vertices
  vertices refines @collection
    extend specification
      extend collection
        override type = @graph/specification/vertex_type
  edges refines @collection
    extend specification
      extend collection
        override type = @graph/specification/edge_type
