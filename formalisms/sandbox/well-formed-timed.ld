// ---- composition symétries × temps — well-formed-timed : le SWN
//      temporisé. L'intervalle [eft, lft] de l'axe temps vit sur la
//      transition ; la couche colorie l'intervalle : il peut lire la
//      liaison (un intervalle par instance de couleur), les
//      sémantiques strong/weak restent dans l'instance. La symétrie
//      d'abord (elle contraint), le temps ensuite (il annote) : un
//      intervalle constant par classe de liaison préserve le quotient
//      — l'ordre déclare cette spécificité, l'instance en pose les
//      valeurs.
layer well-formed-timed refines @well-formed-petrinet then @timed-petrinet
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract binding_intervals
