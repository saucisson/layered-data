// ---- tree — connectivity over the composition: [dag, digraph] —
//      acyclic and pure, plus the tree check at layer level.
//      NOTE (ADR-0022 strate 2): connectivity needs `reachable`, not
//      yet in the first-order fragment. The check stays algorithmic
//      until strate 2 lands.
layer tree refines @dag then @digraph
  check arbre
