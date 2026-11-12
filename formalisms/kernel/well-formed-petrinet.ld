// ---- axe symétries — well-formed-petrinet : le SWN (symmetric /
//      well-formed net) est le réseau coloré CONTRAINT : classes
//      découpées en sous-classes statiques (partitions invariantes
//      par le comportement), inscriptions restreintes aux fonctions
//      d'annotation S (synchronisation), Id (identité) et U
//      (uniformité), marquage initial symétrique. La contrepartie
//      de la contrainte : le quotient de l'espace d'états par le
//      groupe des symétries (symbolic-statespace y vit).
layer well-formed-petrinet refines @colored-petrinet
  extend specification
    extend color_type
      extend specification
        extend record
          abstract static_subclasses
    extend place_type
      extend specification
        extend record
          abstract initial_symmetry
  // les trois fonctions du formalisme, portées par l'axe inscription
  extend edge_type
    extend specification
      extend record
        abstract annotation_functions
