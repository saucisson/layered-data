// ---- the tutorial's Petri net: refines the graph, renames the
//      strata. Vertices → places and transitions (two collections),
//      arcs → arcs: a place's type carries a marking (a token count),
//      an arc's type carries a weight (still abstract — the template
//      will pose it). The aliases: vertices = places ∪ transitions,
//      edges = arcs — the graph's checks keep judging.
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
