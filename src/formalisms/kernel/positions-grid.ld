// ---- the grid — positions-grid: the default system, Cartesian
//      axes; dimension is posed by data (x alone, x and y, or x, y
//      and z)
layer positions-grid refines @positions-scheme
  extend specification
    extend position_type
      extend specification
        extend record
          override system = "grid"
