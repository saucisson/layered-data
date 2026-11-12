// ---- composition algèbre × symétries — algebraic-well-formed : le
//      SWN algébrique. Les inscriptions vivent dans l'algèbre de
//      l'axe algébrique (semianneau commutatif : carrier, plus, times,
//      zero), les couleurs dans les classes contraintes de l'axe
//      symétries (sous-classes statiques, marquage initial
//      symétrique). Les deux parents raffinent le même tronc coloré :
//      l'algèbre d'abord (elle porte la structure des termes), la
//      symétrie ensuite (elle la contraint). La couche pose le pont :
//      plus et times projettent les sous-classes statiques — les
//      termes constants sur les orbites du groupe de symétries, le
//      quotient s'entend.
layer algebraic-well-formed refines @algebraic-petrinet then @well-formed-petrinet
  extend marking_algebra
    extend specification
      extend record
        abstract orbit_invariant_terms
