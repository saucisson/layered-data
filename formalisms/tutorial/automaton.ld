// ---- the tutorial's automaton: the graph's other reading. A graph
//      whose vertices are states, plus an alphabet (a collection of
//      symbols). Nothing new on the arcs: transitions ARE the graph's
//      edges — aliases suffice (vertices = states, edges = transitions),
//      the graph's checks judge the automaton without knowing it is one.
layer automaton refines @graph
  alphabet refines @collection
    extend specification
      extend collection
        override type = @record
  extend specification
    state_type refines @automaton/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
    transition_type refines @automaton/specification/edge_type
  states refines @collection
    extend specification
      extend collection
        override type = @automaton/specification/state_type
  transitions refines @collection
    extend specification
      extend collection
        override type = @automaton/specification/transition_type
  extend vertices refines @automaton/states
  extend edges refines @automaton/transitions
