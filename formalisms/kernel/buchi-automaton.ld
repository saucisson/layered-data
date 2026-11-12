// ---- acceptation de Büchi — buchi-automaton : l'acceptation est
//      l'ensemble des états acceptants, visités infiniment souvent.
//      La condition posée en valeur du slot (override : le parent
//      omega-automaton l'a déclaré), les états marquent leur
//      appartenance dans accepting.
layer buchi-automaton refines @omega-automaton
  extend specification
    extend state_type
      extend specification
        extend record
          override acceptance = "buchi"
          abstract accepting
