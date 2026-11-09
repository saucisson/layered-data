// ---- the tutorial's state space: an automaton PARAMETERIZED by the
//      net. The net slot refines the whole petrinet layer — nobody
//      poses it here. A state's type refines the slot: the state
//      descends from the net, each of the net's markings reads in the
//      state. A binding's type (binding_type) points the net's
//      transitions through the slot — resolved by the
//      couche lisante, jamais ici.
layer state-space refines @automaton
  net refines @petrinet
  extend specification
    extend state_type refines @state-space/net
    binding_type refines @record
      extend specification
        extend record
          transition
            container = @state-space/net/transitions
  extend alphabet
    extend specification
      extend collection
        override type = @state-space/specification/binding_type
