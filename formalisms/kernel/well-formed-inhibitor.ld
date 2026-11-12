// ---- composition symétries × arcs inhibiteurs — well-formed-inhibitor :
//      le zéro-test coloré. L'inhibiteur hérite de l'inscription
//      (l'axe edge_type du coloré descend jusqu'à l'arc croisé) et du
//      seuil (le poids hérité devient le seuil du test, idiome du
//      tronc inhibiteur) ; la symétrie contraint : la fonction
//      d'annotation d'un inhibiteur est S, Id ou U, lue sur le domaine
//      de la place. La contrepartie tient : la classe des marquages
//      symétriques est stable par zéro-test, le quotient s'entend
//      toujours.
layer well-formed-inhibitor refines @well-formed-petrinet then @inhibitor-petrinet
  extend specification
    extend inhibitor_arc_type
      extend specification
        extend record
          abstract zero_test_inscription
