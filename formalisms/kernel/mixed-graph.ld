// ---- mixed-graph — (V, E, A): undirected edges and oriented arcs
//      in the same formalism. Mechanism: pair-graph's pair edges
//      stay available as-is (2 arrows without roles), and the
//      oriented arc is an arc_type refining the pair edge by
//      grafting the source/target roles onto it (multidigraph's
//      self-designation idiom) — the model stores its pairs in
//      edges (the base) and its arcs in arcs (the typed collection
//      below). No model of the trunk refines mixed-graph: mechanism
//      posed, exercised only by the layer's own walk.
layer mixed-graph refines @named-ends-hypergraph then @pair-graph
  extend specification
    arc_type refines @mixed-graph/edge_type
      extend specification
        extend record
          source
            container = @mixed-graph/vertices
          target
            container = @mixed-graph/vertices
      extend arrows
        source
          vertex = @arc_type/source
        target
          vertex = @arc_type/target
  arcs refines @collection
    extend specification
      extend collection
        override type = @mixed-graph/specification/arc_type
