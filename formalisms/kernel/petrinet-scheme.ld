// ---- petrinet-scheme: three parents — the partition
//      (bipartite-digraph), vertex annotation and edge annotation
//      (marking and weight are the named instances of the family).
//      The scheme reuses the axes' types and redefines its
//      containers — names do not refine (places ≠ left), paths do.
layer petrinet-scheme refines @bipartite-digraph then @vertex-annotated-hypergraph then @edge-annotated-hypergraph
  extend specification
    place_type refines @petrinet-scheme/specification/vertex_type
      extend specification
        extend record
          abstract marking
          override abstract identifier
    transition_type refines @petrinet-scheme/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
    // same path as the multidigraph root's edge_type: the Petri
    // arc refines the oriented edge, and adds the weight
    arc_type refines @petrinet-scheme/edge_type
      extend specification
        extend record
          abstract weight
          override abstract identifier
          extend source
            override container = @petrinet-scheme/vertices
          extend target
            override container = @petrinet-scheme/vertices
    // multiple inheritance at the type level: two parents — the
    // Petri arc (weight) and the crossed arc A→B of the partition
    // axis. Order = specificity: the Petri type first, the axis next.
    pre_arc_type refines @petrinet-scheme/specification/arc_type then @bipartite-digraph/specification/arcAB_type
      extend specification
        extend record
          extend source
            override container = @petrinet-scheme/places
          extend target
            override container = @petrinet-scheme/transitions
    post_arc_type refines @petrinet-scheme/specification/arc_type then @bipartite-digraph/specification/arcBA_type
      extend specification
        extend record
          extend source
            override container = @petrinet-scheme/transitions
          extend target
            override container = @petrinet-scheme/places
  places refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/place_type
  transitions refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/transition_type
  pre_arcs refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/pre_arc_type
  post_arcs refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/post_arc_type
  // alias: the arcs are the pre plus the post
  extend arcs refines @petrinet-scheme/pre_arcs then @petrinet-scheme/post_arcs
  extend vertices refines @petrinet-scheme/places then @petrinet-scheme/transitions
  extend edges refines @petrinet-scheme/arcs
