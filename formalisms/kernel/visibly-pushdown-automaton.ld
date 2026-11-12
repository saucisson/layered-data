// ---- composition pile × lecture contrainte — visibly-pushdown-automaton :
//      le VPA des langages à appels-retours. L'alphabet se
//      tripartite (l'espèce de la lettre : call, return, internal) et
//      l'espèce DICTE l'effet de pile — call pousse, return dépile,
//      internal ne touche pas : les push et pop hérités de l'axe
//      pile deviennent la donnée dictée, la lettre tranche. La
//      couche n'ajoute qu'un slot : l'espèce sur la transition,
//      cohérente avec sa lettre (le contrat du modèle). La pile
//      d'abord (elle porte l'effet), la lecture ensuite (elle la
//      contraint).
layer visibly-pushdown-automaton refines @pushdown-automaton then @letter-automaton
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract kind
