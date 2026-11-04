layer pn-philosophers refines @petrinet-scheme
  extend specification
    think refines @pn-philosophers/specification/place_type
    eat refines @pn-philosophers/specification/place_type
    fork refines @pn-philosophers/specification/place_type
    take refines @pn-philosophers/specification/transition_type
    release refines @pn-philosophers/specification/transition_type
    // même chemin que le père : membre du père, pas de refines (idiome de fusion)
    extend arc_type
      weight = 1
      extend specification
        extend record
          override abstract weight
