// ---- l'espace stochastique quotient — symbolic-ctmc : la CTMC
//      lumpée d'un SWN stochastique. Deux parents raffinent le même
//      tronc petrinet-statespace : le symbolique d'abord (l'état
//      porte ses sous-classes dynamiques et son marquage symbolique),
//      le CTMC ensuite (l'état porte sa mesure stationnaire, lue par
//      la lentille qui la calcule). La couche retype le slot : petrinet
//      se re-déclare raffiné par stochastic-well-formed — la couche
//      lisante posera la valeur tard (idiome du tronc). Elle ajoute la
//      cardinalité d'orbite : le poids de l'état symbolique dans la
//      chaîne lumpée — sans elle, les taux agrégés ne s'entendent
//      pas.
layer symbolic-ctmc refines @symbolic-statespace then @ctmc-statespace
  petrinet refines @stochastic-well-formed
  extend specification
    extend state_type
      abstract orbit_cardinality
