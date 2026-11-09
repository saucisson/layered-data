// ---- the positions base — positions-scheme. Named objects receive
//      coordinates in a system: the grid (positions-grid, Cartesian
//      axes) or the pole (positions-polar, distance and angle). The
//      axes are abstract slots posed at the scheme: dimension is
//      data — 1D: x alone; 2D: x and y; 3D: x, y, z (the pole adds
//      z to the plane: the cylinder; the sphere is not posed). A
//      position may be relative: relative_to cites an upstream
//      position and carries an offset — the grid adds component by
//      component, the pole says distance and direction from the
//      cited point; the chain resolves at the first absolute point
//      and the frame does not rotate (rotation would be an axis to
//      name). The datum stays raw: resolution lives in the reader
//      (posOf).
layer positions-scheme refines @record
  extend specification
    position_type refines @record
      extend specification
        extend record
          abstract system
          abstract relative_to
          abstract x
          abstract y
          abstract z
          abstract r
          abstract theta
  positions refines @collection
    extend specification
      extend collection
        override type = @positions-scheme/specification/position_type
