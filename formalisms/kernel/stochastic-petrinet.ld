// ---- axe stochastique — stochastic-petrinet : chaque transition
//      porte un taux (loi exponentielle) et un poids de tir (la
//      discipline de course — race, resampling — vit dans le slot
//      firing_policy, fourni par l'instance). Le défaut du poids
//      vit sur le nœud du type (idiome weighted-hypergraph) ; le
//      taux n'a pas de défaut — une transition sans taux ne
//      s'entend pas, l'instance tranche. Le processus de marquage
//      est une CTMC (ctmc-statespace en est l'espace).
layer stochastic-petrinet refines @petrinet-scheme
  firing_policy refines @record
    extend specification
      extend record
        abstract discipline
  extend specification
    extend transition_type
      firing_weight = 1.0
      extend specification
        extend record
          abstract rate
          abstract firing_weight
