// ---- axe poids — weighted-automaton : chaque transition porte un
//      poids de semianneau (coût, récompense, distance — l'algèbre
//      vit dans l'instance, comme marking_algebra côté Petri).
//      Idiome de weighted-hypergraph : le défaut 1 vit sur le nœud
//      du type, le slot est déclaré dans le record.
layer weighted-automaton refines @automaton-scheme
  extend specification
    extend transition_type
      weight = 1
      extend specification
        extend record
          abstract weight
