// ---- la grille — positions-grid : le système par
//      défaut, axes cartésiens ; la dimension se pose par
//      données (x seul, x et y, ou x, y et z)
layer positions-grid refines @positions-scheme
  extend specification
    extend position_type
      extend specification
        extend record
          override system = "grid"
