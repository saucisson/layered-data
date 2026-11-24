// ---- composition acceptation × probabilité — probabilistic-buchi-automaton :
//      le PBA — la lecture probabiliste des mots infinis. Deux
//      parents, même tronc, ordre = spécificité : l'acceptation
//      d'abord (elle contraint la course), la probabilité ensuite
//      (elle tranche le tir — l'axiome de distribution reste un
//      contrat du modèle). La mesure du mot devient la probabilité
//      de l'ensemble des courses acceptantes ; le seuil vit dans
//      l'acceptance_policy (l'idiome du firing_policy de
//      stochastic-petrinet côté réseaux), fourni par l'instance.
layer probabilistic-buchi-automaton refines @buchi-automaton then @probabilistic-automaton
  acceptance_policy refines @record
    extend specification
      extend record
        abstract threshold
