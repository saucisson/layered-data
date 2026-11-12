// ---- axe pile — pushdown-automaton : un automate à pile (les
//      langages algébriques). La pile est un alphabet (collection
//      dédiée, idiome de l'alphabet du tronc) ; chaque transition
//      porte son effet de pile : push (ce qu'elle empile), pop (ce
//      qu'elle exige au sommet).
layer pushdown-automaton refines @automaton-scheme
  stack_alphabet refines @collection
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract push
          abstract pop
