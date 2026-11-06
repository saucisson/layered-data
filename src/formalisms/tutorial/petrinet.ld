// ---- le réseau de Petri du tutoriel : raffine le graphe, renomme
//      les strates. Sommets → places et transitions (deux
//      collections), arcs → arcs : le type d'une place porte un
//      marking (marquage, un nombre de jetons), le type d'un arc
//      porte un weight (poids, encore abstrait — le template le
//      posera). Les alias : vertices = places ∪ transitions,
//      edges = arcs — les checks du graphe continuent de juger.
layer petrinet refines @graph
  extend specification
    place_type refines @petrinet/specification/vertex_type
      extend specification
        extend record
          abstract marking
          override abstract identifier
    transition_type refines @petrinet/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
    arc_type refines @petrinet/specification/edge_type
      extend specification
        extend record
          abstract weight
          override abstract identifier
  places refines @collection
    extend specification
      extend collection
        override type = @petrinet/specification/place_type
  transitions refines @collection
    extend specification
      extend collection
        override type = @petrinet/specification/transition_type
  arcs refines @collection
    extend specification
      extend collection
        override type = @petrinet/specification/arc_type
  extend vertices refines @petrinet/places then @petrinet/transitions
  extend edges refines @petrinet/arcs
