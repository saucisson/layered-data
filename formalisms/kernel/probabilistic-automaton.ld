// ---- axe probabilité — probabilistic-automaton : la transition
//      porte une distribution (probabilistic : le tir pioche ; le
//      modèle des jeux stochastiques suit la même adresse). Le slot
//      probability vit sur la transition ; l'axiome de distribution
//      (somme 1 par état source) est un contrat du modèle, pas du
//      schéma.
layer probabilistic-automaton refines @automaton-scheme
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract probability
