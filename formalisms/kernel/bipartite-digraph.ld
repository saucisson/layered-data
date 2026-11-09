// ---- partition axis, k = 2 case — bipartite-digraph: the
//      k-partite specialization for two classes, crossed with
//      orientation. Refines multidigraph and k-partite-hypergraph —
//      the math's "bipartite graph" is undirected and simple; ours
//      carries arcs (the inherited k-partite check fires on every
//      descendant). The idiom is the partition's: left / right,
//      crossed arcs A→B and B→A; petrinet-scheme and kahn-scheme
//      refine it.
layer bipartite-digraph refines @multidigraph then @k-partite-hypergraph
  extend specification
    left_type refines @bipartite-digraph/specification/vertex_type
    right_type refines @bipartite-digraph/specification/vertex_type
    // crossed arcs: A→B and B→A, containers imposed by the record
    arcAB_type refines @bipartite-digraph/edge_type
      extend specification
        extend record
          extend source
            override container = @bipartite-digraph/left
          extend target
            override container = @bipartite-digraph/right
    arcBA_type refines @bipartite-digraph/edge_type
      extend specification
        extend record
          extend source
            override container = @bipartite-digraph/right
          extend target
            override container = @bipartite-digraph/left
  left refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/left_type
  right refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/right_type
  arcsAB refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/arcAB_type
  arcsBA refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/arcBA_type
  // alias, same idiom as petrinet-scheme
  arcs refines @bipartite-digraph/arcsAB then @bipartite-digraph/arcsBA
  extend vertices refines @bipartite-digraph/left then @bipartite-digraph/right
  extend edges refines @bipartite-digraph/arcs
