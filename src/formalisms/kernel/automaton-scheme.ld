// ---- le schéma d'automate — un graphe dont les sommets sont des
//      états, plus un alphabet. state_type et transition_type
//      raffinent les types du graphe ; alias inversés : chercher
//      vertices, c'est chercher states — la carte des sommets et
//      celle des états ne font qu'une.
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
