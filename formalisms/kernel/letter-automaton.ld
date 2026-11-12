// ---- axe lecture — letter-automaton : la transition porte sa
//      lettre. L'alphabet du tronc vivait en collection orpheline —
//      l'axe le branche : chaque transition désigne son symbole
//      (désignation tardive vers la collection alphabet, le même
//      idiome que color_domain vers color_classes côté coloré). Pas
//      de défaut : une transition sans lettre est une transition
//      muette (l'epsilon du vide), le slot absent — l'axe ne
//      l'interdit pas, la fermeture le lit.
layer letter-automaton refines @automaton-scheme
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract letter
