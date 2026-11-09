// ---- annotation axis (vertices) — vertex-annotated-hypergraph:
//      a generic "annotation" slot on vertex_type, unbound type —
//      each family will fix it in its refinement (Petri net marking
//      is the example). Member of the parent at the same path: no
//      refines, the parent's closure merges with the base ::
//      specification/vertex_type. Hoisted directly under the base:
//      annotating does not orient.
layer vertex-annotated-hypergraph refines @multihypergraph
  extend specification
    extend vertex_type
      extend specification
        extend record
          abstract annotation
