// ---- composition symétries × stochastique — stochastic-well-formed :
//      le SWN stochastique de la littérature (rates par transition,
//      poids par liaison de couleur). Les deux parents raffinent le
//      même tronc coloré : le premier-gagné tranche les
//      redéfinitions concurrentes, l'ordre déclare la spécificité —
//      la symétrie d'abord (elle contraint le réseau), le taux
//      ensuite (il annote le tir). La discipline de course devient
//      colorée : les taux peuvent lire les sous-classes statiques.
//      L'espace quotient CTMC se lit : symbolic-statespace lié à un
//      stochastic-well-formed.
layer stochastic-well-formed refines @well-formed-petrinet then @stochastic-petrinet
  extend firing_policy
    extend specification
      extend record
        abstract color_aware_rates
