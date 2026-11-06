// ---- l'automate du tutoriel : l'autre lecture du graphe. Un graphe
//      dont les sommets sont des états, plus un alphabet (une
//      collection de symboles). Rien de neuf sur les arcs : les
//      transitions SONT les arêtes du graphe — les alias suffisent
//      (vertices = states, edges = transitions), les checks du
//      graphe jugent l'automate sans savoir qu'il en est un.
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
