// ---- the automaton scheme — a graph whose vertices are states,
//      plus an alphabet. state_type and transition_type refine the
//      graph's types; inverted aliases: looking up vertices is
//      looking up states — the vertex map and the state map are one.
layer automaton-scheme refines @graph
  alphabet refines @collection
  extend specification
    state_type refines @automaton-scheme/specification/vertex_type
    transition_type refines @automaton-scheme/edge_type
  states refines @collection
    extend specification
      extend collection
        override type = @automaton-scheme/specification/state_type
  transitions refines @collection
    extend specification
      extend collection
        override type = @automaton-scheme/specification/transition_type
  extend vertices refines @automaton-scheme/states
  extend edges refines @automaton-scheme/transitions
