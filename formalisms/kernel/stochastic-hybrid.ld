// ---- composition continu × stochastique — stochastic-hybrid : le
//      FSPN (fluid stochastic petri net). La partie discrète est une
//      CTMC (l'axe stochastique), la partie fluide un flot à débit
//      (l'axe continu) ; la couche pose le couplage : le débit de la
//      transition fluide lit le marquage discret — le flot est piloté
//      par le saut. L'hybride d'abord (l'ordre du tronc discret puis
//      de l'axe fluide est déjà le sien), le taux ensuite : la
//      discipline de course couvre les deux phases, l'instance
//      tranche.
layer stochastic-hybrid refines @hybrid-petrinet then @stochastic-petrinet
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract marking_dependent_flow
