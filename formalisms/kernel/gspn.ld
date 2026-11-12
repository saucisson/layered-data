// ---- composition stochastique × priorité — gspn : le GSPN de
//      l'usage (immediates et temporisées). Deux parents, ordre =
//      spécificité (O2) : le stochastique d'abord (la discipline de
//      course), la priorité ensuite (l'axe du conflit). La couche
//      n'ajoute qu'un slot : immediate (faux par défaut sur le
//      nœud du type) — les transitions immédiates tirent sans
//      temps, leur firing_weight tranche les conflits.
layer gspn refines @stochastic-petrinet then @priority-petrinet
  extend specification
    extend transition_type
      immediate = false
      extend specification
        extend record
          abstract immediate
