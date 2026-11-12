// ---- l'espace stochastique — ctmc-statespace : l'automate du tronc
//      paramétré par le réseau (idiome de petrinet-statespace), lu
//      sur un réseau stochastique : le processus de marquage est
//      une chaîne de Markov à temps continu. La couche n'ajoute que
//      le vocabulaire du résultat : steady_state, la mesure lue sur
//      l'état par la lentille qui la calcule — c'est un slot, pas
//      une donnée du modèle.
layer ctmc-statespace refines @petrinet-statespace
  extend specification
    extend state_type
      abstract steady_state
