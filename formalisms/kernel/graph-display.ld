// ---- generic lens: circle and line for every digraph descendant —
//      the templates live at the same path as the types: the line is
//      at the root, like multidigraph's edge
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
