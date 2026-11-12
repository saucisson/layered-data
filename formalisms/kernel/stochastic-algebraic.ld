// ---- composition algèbre × stochastique — stochastic-algebraic : le
//      réseau algébrique stochastique. Le taux de l'axe stochastique
//      devient un terme : il lit le marquage comme élément de
//      l'algèbre posée dans sa couche (le slot rate reste abstrait —
//      l'instance le lie à une lentille sur l'algèbre, la fermeture
//      suit). L'algèbre d'abord (elle porte), le taux ensuite (il
//      annote le tir) : la course est tranchée dans le semianneau, la
//      CTMC s'ensuit (ctmc-statespace).
layer stochastic-algebraic refines @algebraic-petrinet then @stochastic-petrinet
  extend firing_policy
    extend specification
      extend record
        abstract marking_aware_rates
