// ---- composition symétries × GSPN — well-formed-gspn : le SWN de
//      l'usage GreatSPN, transitions temporisées ET immédiates. Deux
//      parents qui ne partagent que le tronc : la symétrie d'abord
//      (elle contraint les inscriptions), le GSPN ensuite (il apporte
//      par sa propre composition la discipline de course, la priorité
//      et le slot immediate — faux par défaut sur le nœud du type).
//      La couche ajoute le vocabulaire du croisement : les poids des
//      immédiates deviennent conscients des sous-classes statiques —
//      un poids lit la sous-classe de sa liaison, la course entre
//      instances se tranche dans le quotient, la CTMC lumpée
//      s'ensuit (symbolic-ctmc).
layer well-formed-gspn refines @well-formed-petrinet then @gspn
  extend firing_policy
    extend specification
      extend record
        abstract subclass_aware_immediates
