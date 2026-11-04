// ---- lentille générique : cercle et trait pour tout descendant du
// digraphe — les gabarits vivent au même chemin que les types : le
// trait est à la racine, comme l'arête de multidigraph
layer graph-display refines @multidigraph
  extend specification
    extend vertex_type
      display
        shape = "circle"
        fill = "#ffffff"
        stroke = "#455555"
  extend edge_type
    display
      shape = "line"
      arrow = "plain"
      stroke = "#455555"
