// ---- automaton lens: the double circle on the accepting states of
//      the omega family (buchi, parity…) — the ordinary states keep
//      the generic circle inherited from @graph-display. Proof lens
//      for the parametric vocabulary (issue #284): two overlaid
//      circles of distinct radii under a presence guard.
layer automaton-display refines @graph-display then @omega-automaton
  extend specification
    extend state_type
      extend display when accepting
        glyphs
          ring1
            shape = "circle"
            fill = "#ffffff"
            stroke = "#455555"
          ring2
            shape = "circle"
            r = 11
            stroke = "#455555"
