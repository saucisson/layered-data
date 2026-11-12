// ---- acceptation par familles — muller-automaton : une famille de
//      sous-ensembles d'états ; le mot est accepté si l'ensemble des
//      états visités infiniment souvent est dans la famille. La
//      famille vit en collection dédiée (l'idiome de l'alphabet du
//      tronc) : chaque membre désigne un sous-ensemble d'états
//      (désignation tardive multiple, résolue par la couche lisante).
//      La parité du tronc en est le codage efficace — la mesure se
//      lit sur toutes les acceptations à la fois.
layer muller-automaton refines @omega-automaton
  accepting_family refines @collection
  extend specification
    extend state_type
      extend specification
        extend record
          override acceptance = "muller"
