// ---- the P/T bound case — pt-petrinet: petrinet-scheme with the
//      valuation type fixed to natural integers. The scheme stays
//      abstract (abstract marking, abstract weight); this layer is
//      where the concrete defaults live: marking = 0 on the place
//      type, weight = 1 on the arc type. The token type is the
//      integer itself, and the marking is a pt-multiset (ℕ
//      multiplicities). A colored or algebraic net refines
//      petrinet-scheme directly and never sees these defaults —
//      its inscriptions are terms, not integers.
layer pt-petrinet refines @petrinet-scheme
  extend specification
    extend token_type
      identifier = "integer"
    extend place_type
      marking = 0
    extend arc_type
      weight = 1
  // the marking is a ℕ-multiset of integer tokens
  extend place_marking refines @pt-multiset
    extend specification
      extend multiset
        override element_type = @pt-petrinet/specification/token_type
