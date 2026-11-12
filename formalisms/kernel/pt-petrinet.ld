// ---- the P/T bound case — pt-petrinet: petrinet-scheme with the
//      valuation type fixed to natural integers. The scheme stays
//      abstract (abstract marking, abstract weight); this layer is
//      where the concrete defaults live: marking = 0 on the place
//      type, weight = 1 on the arc type. A colored or algebraic net
//      refines petrinet-scheme directly and never sees these
//      defaults — its inscriptions are terms, not integers.
layer pt-petrinet refines @petrinet-scheme
  extend specification
    extend place_type
      marking = 0
    extend arc_type
      weight = 1
