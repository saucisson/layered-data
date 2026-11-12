// ---- axe sortie de transition — mealy-machine : la sortie est
//      portée par la transition (elle dépend du franchissement, pas
//      du point d'arrivée). Même chemin que l'axe inscription des
//      réseaux colorés : le slot vit dans le record du type de
//      transition, l'arête annotée du tronc le rend lisible à
//      chaque arc.
layer mealy-machine refines @automaton-scheme
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract output
