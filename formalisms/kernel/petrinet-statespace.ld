// ---- the state space — an automaton parameterized by the net:
//      the petrinet slot (typed petrinet-scheme), the behavior (the
//      same parameter), and state_type refining the behavior's state
//      type. The dependency is not prose: the space and the net
//      share addresses.
layer petrinet-statespace refines @automaton-scheme
  petrinet refines @petrinet-scheme
  behavior refines @petrinet-behavior
    petrinet = @petrinet-statespace/petrinet
  extend specification
    extend state_type refines @petrinet-statespace/behavior/specification/state_type
  extend alphabet
    extend specification
      extend collection
        override type = @petrinet-statespace/behavior/specification/binding_type
