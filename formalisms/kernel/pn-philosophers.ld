layer pn-philosophers refines @pt-petrinet
  extend specification
    think refines @pn-philosophers/specification/place_type
    eat refines @pn-philosophers/specification/place_type
    fork refines @pn-philosophers/specification/place_type
    take refines @pn-philosophers/specification/transition_type
    release refines @pn-philosophers/specification/transition_type
