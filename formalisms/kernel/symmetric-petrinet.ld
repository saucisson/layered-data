// ---- axe symétries (nom ISO) — symmetric-petrinet : le « Symmetric
//      Net » d'ISO 15909-2 est le well-formed-petrinet renommé par la
//      norme — la couche raffine le tronc et ajoute l'ORDRE STATIQUE :
//      une classe colorée peut être ordonnée (ordre total sur ses
//      éléments), ce qui ouvre le successeur ⊕1 dans les inscriptions
//      et les prédicats d'inégalité dans les gardes. Idiome de
//      weighted-hypergraph : le défaut vit sur le nœud du type (une
//      classe non raffinée n'est pas ordonnée), le slot dans le
//      record — la classe qui déclare l'ordre voit ses sous-classes
//      statiques contraintes aux intervalles contigus. Une classe non
//      ordonnée ne porte pas le successeur, le prédicat ne s'y entend
//      pas.
layer symmetric-petrinet refines @well-formed-petrinet
  extend specification
    extend color_type
      ordered = false
      extend specification
        extend record
          abstract ordered
