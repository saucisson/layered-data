// ---- axe temps — timed-petrinet : le réseau temporel de Merlin
//      (TPN) — chaque transition porte un intervalle [eft, lft] de
//      tir : activée depuis eft, obligée à lft (sémantiques strong /
//      weak : l'axe est posé, la discipline vit dans l'instance).
//      Pas de défaut : une transition sans intervalle est une
//      transition non temporisée.
layer timed-petrinet refines @petrinet-scheme
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract eft
          abstract lft
