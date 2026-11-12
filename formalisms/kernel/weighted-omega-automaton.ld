// ---- composition poids × acceptation — weighted-omega-automaton :
//      la branche quantitative des mots infinis. Le poids du
//      semianneau hérité annote chaque transition ; la course étant
//      infinie, la mesure n'est plus une somme — la discipline
//      d'agrégation tranche la lecture (limsup, liminf, ... la
//      valeur vit dans l'instance). Le poids 1 du nœud du type reste
//      le cas dégénéré (l'automate pondéré du tronc s'y lit). Le
//      poids d'abord (il annote la transition), l'acceptation ensuite
//      (elle contraint la course infinie) : l'ordre déclare la
//      spécificité.
layer weighted-omega-automaton refines @weighted-automaton then @omega-automaton
  aggregation refines @record
    extend specification
      extend record
        abstract discipline
