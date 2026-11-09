// ---- the behavior — parameterized by the net. A state's type
//      refines the "petrinet" parameter: a path that does not exist
//      here — resolved by late binding in the reading layer
//      (ss-pn-philosophers-5 poses petrinet = pn-philosophers-5:
//      the type of a state of ss-pn-philosophers-5 is
//      pn-philosophers-5). A binding's type (binding_type) points
//      the net's transitions — forward ref assumed: the petrinet
//      slot lives in petrinet-statespace, provided below.
layer petrinet-behavior refines @record
  extend specification
    state_type refines @petrinet-behavior/petrinet
    binding_type refines @record
      extend specification
        extend record
          transition
            container = @petrinet-statespace/petrinet/transitions
