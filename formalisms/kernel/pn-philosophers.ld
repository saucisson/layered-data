layer pn-philosophers refines @petrinet-scheme
  extend specification
    think refines @pn-philosophers/specification/place_type
    eat refines @pn-philosophers/specification/place_type
    fork refines @pn-philosophers/specification/place_type
    take refines @pn-philosophers/specification/transition_type
    release refines @pn-philosophers/specification/transition_type
    // same path as the parent: member of the parent, no refines (merge idiom)
    extend arc_type
      weight = 1
      extend specification
        extend record
          override abstract weight
