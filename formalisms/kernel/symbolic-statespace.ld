// ---- l'espace symbolique — symbolic-statespace : le quotient d'un
//      SWN par son groupe de symétries. L'état symbolique porte ses
//      sous-classes dynamiques (la partition courante des couleurs,
//      évoluant avec le marquage) et son marquage symbolique ; les
//      liaisons de l'alphabet deviennent des classes de liaisons.
//      Le réseau est un slot : la couche lisante lie un
//      well-formed-petrinet, la fermeture fait le reste.
layer symbolic-statespace refines @petrinet-statespace
  extend specification
    extend state_type
      abstract dynamic_subclasses
      abstract symbolic_marking
