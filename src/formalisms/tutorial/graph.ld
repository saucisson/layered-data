// ---- the tutorial's graph: the base metamodel. Vertices and
//      arcs, typed (identifier) and stored in two keyed collections;
//      each arc points its two ends through source and target, the
//      container annotation says where the ends live. Two check tags
//      posed here descend into every refinement: containers (an arc's
//      ends are vertices of the net) and cardinality (a collection
//      respects its bounds).
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
