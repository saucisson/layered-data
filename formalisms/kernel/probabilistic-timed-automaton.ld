// ---- composition temps × probabilité — probabilistic-timed-automaton :
//      le PTA du model-checking statistique. Deux parents, même
//      tronc, ordre = spécificité : le temps d'abord (il contraint
//      l'horloge), la probabilité ensuite (elle tranche le tir. Les
//      redéfinitions concurrentes n'existent pas : les axes sont
//      disjoints, la fermeture réunit.
layer probabilistic-timed-automaton refines @timed-automaton then @probabilistic-automaton
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract reward
