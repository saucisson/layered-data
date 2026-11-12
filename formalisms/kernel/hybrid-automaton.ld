// ---- composition temps × continu — hybrid-automaton : l'automate
//      hybride — l'automate temporisé dont les variables évoluent
//      par flots continus entre les sauts. Les variables continues
//      vivent dans une collection (idiome de l'alphabet du tronc) ;
//      chaque état porte son flot, chaque transition sa garde et
//      ses réinitialisations.
layer hybrid-automaton refines @timed-automaton
  variables refines @collection
  extend specification
    extend state_type
      extend specification
        extend record
          abstract flows
    extend transition_type
      extend specification
        extend record
          abstract jump
