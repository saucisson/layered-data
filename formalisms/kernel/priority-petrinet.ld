// ---- axe priorité — priority-petrinet : chaque transition porte un
//      niveau de priorité ; à conflit, la plus haute tranche. Idiome
//      de weighted-hypergraph : le défaut vit sur le nœud du type
//      (toute transition non raffinée lit 0), le slot est déclaré
//      dans le record — l'instance fournit, la lecture carotte.
layer priority-petrinet refines @petrinet-scheme
  extend specification
    extend transition_type
      priority = 0
      extend specification
        extend record
          abstract priority
